#include "FlyClock.h"

#include "AssetRegistry/AssetRegistryModule.h"
#include "CineCameraComponent.h"
#include "Components/AudioComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/LightComponentBase.h"
#include "Components/ModelComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/Level.h"
#include "Engine/StaticMesh.h"
#include "Engine/TextureCube.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "FlyActor.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Sound/SoundAttenuation.h"
#include "Sound/SoundWave.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	constexpr double StepSeconds = 1.0 / 60.0;
	// Eine Panel-Einheit in Zentimetern: Fliege 16 Einheiten, also gut 7 mm lang.
	constexpr double StageScale = 0.045;
	constexpr int32 RoverCount = 3;

	// Schräger Blick auf den Waldboden, Brennpunkt auf den Ziffern. Flacher als etwa 50° staucht die Ziffern zu stark.
	constexpr double CameraPitch = 54.0;
	constexpr double CameraDistance = 30.0;
	constexpr float FocalLength = 40.0f;
	constexpr float Aperture = 9.0f;

	const TCHAR* const SolidPath = TEXT("/Game/FlyClock/M_Solid.M_Solid");
	const TCHAR* const WingPath = TEXT("/Game/FlyClock/M_Wing.M_Wing");
	const TCHAR* const BuzzPath = TEXT("/Game/FlyClock/S_Buzz.S_Buzz");
	const TCHAR* const ScanFolder = TEXT("/Game/FlyClock/Scan");
	const TCHAR* const GroundPath = TEXT("/Game/Forest/M_Ground.M_Ground");
	const TCHAR* const SkyMaterialPath = TEXT("/Game/Forest/M_Sky.M_Sky");
	const TCHAR* const SkyCubePath = TEXT("/Game/Forest/Sky/T_Sky.T_Sky");

	// Drehung des Scans in den Fliegenrahmen (Kopf nach +X, Rücken nach +Z).
	const FRotator ScanRotation(0.0, -90.0, 0.0);

	// Murmelbrett in Zentimetern. 56 Murmeln reichen für 08:08 mit sechs übrigen am Rand.
	constexpr double BoardTop = 1.8;
	constexpr double RimWidth = 1.4;
	constexpr double RimHeight = 1.5;
	constexpr int32 MarbleCount = 56;
	const TCHAR* const MarblePath = TEXT("/Game/Marbles/M_Marble.M_Marble");
	const TCHAR* const WoodPath = TEXT("/Game/Marbles/M_Wood.M_Wood");
	const TCHAR* const ClackPath = TEXT("/Game/Marbles/S_Clack.S_Clack");
	// Die acht Oxyd-Glasfarben wie in sim/oxyd.js: schwarz, weiß, rot, grün, blau, gelb, magenta, cyan.
	const FLinearColor MarbleColors[8] = {
		FLinearColor(0.008f, 0.008f, 0.01f),
		FLinearColor(0.55f, 0.56f, 0.58f),
		FLinearColor(0.28f, 0.03f, 0.025f),
		FLinearColor(0.03f, 0.15f, 0.05f),
		FLinearColor(0.05f, 0.06f, 0.3f),
		FLinearColor(0.42f, 0.32f, 0.04f),
		FLinearColor(0.25f, 0.03f, 0.22f),
		FLinearColor(0.03f, 0.2f, 0.25f)
	};

	int32 PeakCount()
	{
		return MakeClockSlots(8, 8).Num();
	}

	UMaterialInstanceDynamic* Tint(UMaterialInterface* Base, UObject* Outer, const FLinearColor& Color, float Roughness, float Opacity = 1.0f)
	{
		if (!Base) return nullptr;
		UMaterialInstanceDynamic* Material = UMaterialInstanceDynamic::Create(Base, Outer);
		Material->SetVectorParameterValue(TEXT("Color"), Color);
		Material->SetScalarParameterValue(TEXT("Roughness"), Roughness);
		Material->SetScalarParameterValue(TEXT("Opacity"), Opacity);
		return Material;
	}

	FVector2D PanelToWorld(const FVector2D& Panel)
	{
		return FVector2D(FlyPanel::H / 2.0 - Panel.Y, Panel.X - FlyPanel::W / 2.0) * StageScale;
	}
}

AFlyClock::AFlyClock()
{
	PrimaryActorTick.bCanEverTick = true;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> PlaneMesh(TEXT("/Engine/BasicShapes/Plane.Plane"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	Root->SetMobility(EComponentMobility::Movable);
	RootComponent = Root;

	Stage = CreateDefaultSubobject<USceneComponent>(TEXT("Stage"));
	Stage->SetupAttachment(Root);
	Stage->SetMobility(EComponentMobility::Movable);
	Stage->SetRelativeScale3D(FVector(StageScale));

	// 30 × 30 m Waldboden, das Material kachelt in Weltkoordinaten.
	Ground = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Ground"));
	Ground->SetupAttachment(Root);
	Ground->SetStaticMesh(PlaneMesh.Object);
	Ground->SetRelativeScale3D(FVector(30.0));
	Ground->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	// HDRI-Kuppel als sichtbarer Hintergrund. Das Licht kommt vom Himmelslicht, nicht von ihr.
	Dome = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Dome"));
	Dome->SetupAttachment(Root);
	Dome->SetStaticMesh(SphereMesh.Object);
	Dome->SetRelativeScale3D(FVector(2000.0));
	Dome->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Dome->CastShadow = false;
	Dome->bAffectDynamicIndirectLighting = false;
	Dome->bAffectDistanceFieldLighting = false;

	Camera = CreateDefaultSubobject<UCineCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(Root);
	Camera->Filmback.SensorWidth = 24.0f;
	Camera->Filmback.SensorHeight = 24.0f * static_cast<float>(FlyPanel::H / FlyPanel::W);
	Camera->CurrentFocalLength = FocalLength;
	Camera->CurrentAperture = Aperture;
	Camera->FocusSettings.FocusMethod = ECameraFocusMethod::Manual;
	Camera->bConstrainAspectRatio = true;
	FPostProcessSettings& Post = Camera->PostProcessSettings;
	Post.bOverride_MotionBlurAmount = true;
	Post.MotionBlurAmount = 0.6f;
	Post.bOverride_VignetteIntensity = true;
	Post.VignetteIntensity = 0.35f;
	Post.bOverride_BloomIntensity = true;
	Post.BloomIntensity = 0.35f;
	Post.bOverride_FilmGrainIntensity = true;
	Post.FilmGrainIntensity = 0.06f;
	Post.bOverride_AutoExposureBias = true;
	Post.AutoExposureBias = -0.1f;
	// Ruhigerer, etwas entsättigter Boden mit mehr Kontrast, damit die dunklen Fliegen herausstechen.
	Post.bOverride_ColorSaturation = true;
	Post.ColorSaturation = FVector4(0.75, 0.75, 0.75, 1.0);
	Post.bOverride_ColorContrast = true;
	Post.ColorContrast = FVector4(1.2, 1.2, 1.2, 1.0);

	// Tiefe Nachmittagssonne von hinten rechts: Gegenlicht auf Flügeln, Schatten zur Kamera.
	Sun = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Sun"));
	Sun->SetupAttachment(Root);
	Sun->SetMobility(EComponentMobility::Movable);
	Sun->SetRelativeRotation(FRotator(-36.0, 205.0, 0.0));
	Sun->SetIntensity(18.0f);
	Sun->SetLightColor(FLinearColor(1.0f, 0.9f, 0.76f));
	Sun->SetCastShadows(true);
	Sun->LightSourceAngle = 0.6f;
	// Die Standard-Schattenversätze sind für Meter gedacht, bei Murmeln und Fliegen klafft sonst eine Lücke.
	Sun->ShadowBias = 0.05f;
	Sun->ShadowSlopeBias = 0.05f;
	Sun->ContactShadowLength = 0.08f;

	Sky = CreateDefaultSubobject<USkyLightComponent>(TEXT("Sky"));
	Sky->SetupAttachment(Root);
	Sky->SetMobility(EComponentMobility::Movable);
	Sky->SourceType = ESkyLightSourceType::SLS_SpecifiedCubemap;
	Sky->SetIntensity(0.7f);

	Buzz = CreateDefaultSubobject<UAudioComponent>(TEXT("Buzz"));
	Buzz->SetupAttachment(Root);
	Buzz->bAutoActivate = false;
	Buzz->bAllowSpatialization = false;
}

void AFlyClock::BeginPlay()
{
	Super::BeginPlay();
	HideMapContent();

	BuildForest();
	BuildTray();
	SetFace(FParse::Param(FCommandLine::Get(), TEXT("marbles")));

	// Mit -closeup beginnt die Kamera dicht an den Ziffern.
	if (FParse::Param(FCommandLine::Get(), TEXT("closeup"))) ViewWanted.Z = bMarbles ? 16.0 : 7.0;
	// -view=Drehung,Neigung,Abstand, etwa -view=60,15,20 für einen flachen Blick von der Seite.
	FString View;
	if (FParse::Value(FCommandLine::Get(), TEXT("view="), View, false))
	{
		TArray<FString> Parts;
		View.ParseIntoArray(Parts, TEXT(","));
		for (int32 i = 0; i < FMath::Min(3, Parts.Num()); i++) ViewWanted[i] = FCString::Atod(*Parts[i]);
		UE_LOG(LogTemp, Display, TEXT("FlyClock: Ansicht %s"), *ViewWanted.ToString());
	}
	ViewNow = ViewWanted;
	ApplyView();

	const int32 Pool = PeakCount() * 2;
	Swarm.Init(Pool, RoverCount);
	for (int32 i = 0; i < Pool + RoverCount; i++)
	{
		AFlyActor* Visual = GetWorld()->SpawnActor<AFlyActor>(FVector::ZeroVector, FRotator::ZeroRotator);
		Visual->AttachToComponent(Stage, FAttachmentTransformRules::KeepRelativeTransform);
		Visual->SetActorHiddenInGame(true);
		Visuals.Add(Visual);
	}
	LoadLook();

	if (USoundWave* Wave = LoadObject<USoundWave>(nullptr, BuzzPath))
	{
		Wave->bLooping = true;
		Wave->VirtualizationMode = EVirtualizationMode::PlayWhenSilent;
		Buzz->SetSound(Wave);
		Buzz->SetVolumeMultiplier(0.001f);
		Buzz->Play();

		// Die freien Fliegen summen räumlich: lauter, wenn sie an der Kamera vorbeiziehen.
		for (int32 i = Pool; i < Pool + RoverCount; i++)
		{
			UAudioComponent* Voice = NewObject<UAudioComponent>(Visuals[i]);
			Voice->SetupAttachment(Visuals[i]->GetRootComponent());
			Voice->bAutoActivate = false;
			Voice->bAllowSpatialization = true;
			Voice->bOverrideAttenuation = true;
			Voice->AttenuationOverrides.bAttenuate = true;
			Voice->AttenuationOverrides.bSpatialize = true;
			Voice->AttenuationOverrides.AttenuationShapeExtents = FVector(6.0f);
			Voice->AttenuationOverrides.FalloffDistance = 140.0f;
			Voice->RegisterComponent();
			Voice->SetSound(Wave);
			Voice->SetVolumeMultiplier(0.001f);
			Voice->SetPitchMultiplier(0.9f + 0.1f * (i - Pool));
			Voice->Play(FMath::FRand() * 2.0f);
			RoverBuzz.Add(Voice);
			RoverLevel.Add(0.0f);
		}
	}

	if (APlayerController* Controller = GetWorld()->GetFirstPlayerController())
	{
		Controller->SetViewTarget(this);
	}
}

void AFlyClock::HideMapContent()
{
	// Die Entry-Map bringt BSP-Geometrie und eventuell Lichter mit, die das Panel verdecken.
	for (UModelComponent* Model : GetWorld()->PersistentLevel->ModelComponents)
	{
		if (Model) Model->SetVisibility(false);
	}
	for (TActorIterator<AActor> It(GetWorld()); It; ++It)
	{
		AActor* Actor = *It;
		if (Actor == this || Actor->IsA<AFlyActor>()) continue;
		TArray<UPrimitiveComponent*> Primitives;
		Actor->GetComponents(Primitives);
		TArray<ULightComponentBase*> Lights;
		Actor->GetComponents(Lights);
		if (Primitives.IsEmpty() && Lights.IsEmpty()) continue;
		Actor->SetActorHiddenInGame(true);
		Actor->SetActorEnableCollision(false);
		for (ULightComponentBase* Light : Lights)
		{
			Light->SetVisibility(false);
		}
	}
}

void AFlyClock::Place(const TCHAR* Folder, const TCHAR* Name, const FVector2D& At, double Yaw, double Scale, double Sink)
{
	const FString Path = FString::Printf(TEXT("/Game/Forest/%s/%s.%s"), Folder, Name, Name);
	UStaticMesh* Mesh = LoadObject<UStaticMesh>(nullptr, *Path);
	if (!Mesh) return;
	UStaticMeshComponent* Prop = NewObject<UStaticMeshComponent>(this);
	Prop->SetupAttachment(Root);
	Prop->SetStaticMesh(Mesh);
	Prop->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	// Am Fußpunkt der Hülle ausrichten, Sink versenkt einen Teil der Höhe im Boden.
	const FBox Box = Mesh->GetBoundingBox();
	FVector Anchor = Box.GetCenter();
	Anchor.Z = Box.Min.Z + Sink * (Box.Max.Z - Box.Min.Z);
	const FRotator Rotation(0.0, Yaw, 0.0);
	Prop->SetRelativeRotation(Rotation);
	Prop->SetRelativeScale3D(FVector(Scale));
	Prop->SetRelativeLocation(FVector(At.X, At.Y, 0.0) - Rotation.RotateVector(Anchor * Scale));
	Prop->RegisterComponent();
	Props.Add(Prop);
}

void AFlyClock::BuildForest()
{
	if (UMaterialInterface* Floor = LoadObject<UMaterialInterface>(nullptr, GroundPath))
	{
		Ground->SetMaterial(0, Floor);
	}
	if (UMaterialInterface* SkyMaterial = LoadObject<UMaterialInterface>(nullptr, SkyMaterialPath))
	{
		Dome->SetMaterial(0, SkyMaterial);
	}
	if (UTextureCube* Cube = LoadObject<UTextureCube>(nullptr, SkyCubePath))
	{
		Sky->SetCubemap(Cube);
		Sky->RecaptureSky();
	}

	// Hintergrund in Zentimetern: Kamera bei −X, Blick nach +X, die Ziffern liegen um den Ursprung.
	Place(TEXT("dead_tree_trunk"), TEXT("dead_tree_trunk_2k"), FVector2D(72.0, 50.0), 78.0, 1.0, 0.1);
	Place(TEXT("tree_stump_01"), TEXT("tree_stump_01_2k"), FVector2D(105.0, -55.0), 30.0, 1.0, 0.3);
	Place(TEXT("pine_roots"), TEXT("pine_roots_b1"), FVector2D(42.0, -62.0), 20.0, 1.0, 0.25);
	Place(TEXT("pine_roots"), TEXT("pine_roots_a1"), FVector2D(35.0, 95.0), -30.0, 1.0, 0.25);
	Place(TEXT("fern_02"), TEXT("fern_02_b"), FVector2D(95.0, 55.0), 0.0, 1.0, 0.05);
	Place(TEXT("fern_02"), TEXT("fern_02_d"), FVector2D(40.0, -55.0), 40.0, 1.0, 0.05);
	Place(TEXT("fir_sapling"), TEXT("fir_sapling_a"), FVector2D(175.0, 25.0), 0.0, 1.0, 0.0);
	Place(TEXT("fir_sapling"), TEXT("fir_sapling_b"), FVector2D(240.0, 120.0), 60.0, 1.0, 0.0);
	Place(TEXT("fir_sapling"), TEXT("fir_sapling_c"), FVector2D(260.0, -90.0), 10.0, 1.0, 0.0);
	Place(TEXT("rock_moss_set_02"), TEXT("rock_moss_set_02_rock09"), FVector2D(160.0, -160.0), 40.0, 1.0, 0.15);
	Place(TEXT("rock_moss_set_01"), TEXT("rock_moss_set_01_rock05"), FVector2D(330.0, 170.0), 0.0, 1.0, 0.3);
	Place(TEXT("root_cluster_01"), TEXT("root_cluster_01_2k"), FVector2D(360.0, -60.0), 10.0, 1.0, 0.05);

	// Mittelgrund: ein Zweig hinter den Ziffern, einer rechts zur Kamera hin.
	Place(TEXT("dry_branches_medium_01"), TEXT("dry_branches_medium_01_b"), FVector2D(20.0, -4.0), 72.0, 0.22, 0.1);
	Place(TEXT("dry_branches_medium_01"), TEXT("dry_branches_medium_01_c"), FVector2D(-2.0, 16.0), 84.0, 0.25, 0.15);

	// Nahbereich: Steinchen und Zweiglein rund um die Ziffern, aber nicht auf ihnen.
	static const TCHAR* const Pebbles[] = {
		TEXT("rock_moss_set_02_rock08"), TEXT("rock_moss_set_02_rock12"), TEXT("rock_moss_set_02_rock09")
	};
	FRandomStream Random(7);
	auto Clear = [](const FVector2D& P) { return FMath::Abs(P.X) < 4.0 && FMath::Abs(P.Y) < 10.0; };
	for (int32 i = 0; i < 18; i++)
	{
		const FVector2D P(Random.FRandRange(-16.0, 26.0), Random.FRandRange(-15.0, 15.0));
		if (Clear(P)) continue;
		Place(TEXT("rock_moss_set_02"), Pebbles[Random.RandHelper(UE_ARRAY_COUNT(Pebbles))], P, Random.FRandRange(0.0, 360.0), Random.FRandRange(0.008, 0.025), 0.3);
	}
	for (int32 i = 0; i < 8; i++)
	{
		const FVector2D P(Random.FRandRange(-14.0, 22.0), Random.FRandRange(-14.0, 14.0));
		if (Clear(P)) continue;
		Place(TEXT("dry_branches_medium_01"), TEXT("dry_branches_medium_01_b"), P, Random.FRandRange(0.0, 360.0), Random.FRandRange(0.05, 0.1), 0.1);
	}

	// Nichts, was in die Ziffern ragt: Zweige und Steine quer durch die Fliegen machen die Uhrzeit unleserlich.
	const TArray<FFlySlot> Slots = MakeClockSlots(8, 8);
	FBox2D Digits(ForceInit);
	for (const FFlySlot& Slot : Slots)
	{
		Digits += PanelToWorld(Slot.P);
	}
	Digits = Digits.ExpandBy(2.5);
	Props.RemoveAll([&Digits](const TObjectPtr<UStaticMeshComponent>& Prop)
	{
		const FBox Bounds = Prop->Bounds.GetBox();
		// Große Hintergrundstücke bleiben; ihre achsenparallele Hülle reicht oft weit über das Sichtbare hinaus.
		if (Bounds.GetSize().GetMax() > 40.0) return false;
		if (!Digits.Intersect(FBox2D(FVector2D(Bounds.Min.X, Bounds.Min.Y), FVector2D(Bounds.Max.X, Bounds.Max.Y)))) return false;
		Prop->DestroyComponent();
		return true;
	});
}

void AFlyClock::BuildTray()
{
	UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
	UMaterialInterface* Wood = LoadObject<UMaterialInterface>(nullptr, WoodPath);
	auto Part = [&](const FVector& Center, const FVector& Size)
	{
		UStaticMeshComponent* Piece = NewObject<UStaticMeshComponent>(this);
		Piece->SetupAttachment(Root);
		Piece->SetStaticMesh(Cube);
		if (Wood) Piece->SetMaterial(0, Wood);
		Piece->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Piece->SetRelativeLocation(Center);
		Piece->SetRelativeScale3D(Size / 100.0);
		Piece->RegisterComponent();
		TrayParts.Add(Piece);
	};

	// Innenkante in Zentimetern: Panel-y wird Bühnen-X, Panel-x wird Bühnen-Y.
	const FVector2D Low = PanelToWorld(FVector2D(MarbleTray::MinX, MarbleTray::MaxY));
	const FVector2D High = PanelToWorld(FVector2D(MarbleTray::MaxX, MarbleTray::MinY));
	const FVector2D Mid = (Low + High) / 2.0;
	const FVector2D Inner = High - Low;
	const double RimZ = BoardTop + RimHeight / 2.0;
	Part(FVector(Mid.X, Mid.Y, BoardTop / 2.0), FVector(Inner.X + 2.0 * RimWidth, Inner.Y + 2.0 * RimWidth, BoardTop));
	Part(FVector(Mid.X, Low.Y - RimWidth / 2.0, RimZ), FVector(Inner.X + 2.0 * RimWidth, RimWidth, RimHeight));
	Part(FVector(Mid.X, High.Y + RimWidth / 2.0, RimZ), FVector(Inner.X + 2.0 * RimWidth, RimWidth, RimHeight));
	Part(FVector(Low.X - RimWidth / 2.0, Mid.Y, RimZ), FVector(RimWidth, Inner.Y, RimHeight));
	Part(FVector(High.X + RimWidth / 2.0, Mid.Y, RimZ), FVector(RimWidth, Inner.Y, RimHeight));

	UStaticMesh* Sphere = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/EngineMeshes/Sphere.Sphere"));
	if (!Sphere) Sphere = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	const FBox Bounds = Sphere->GetBoundingBox();
	MarbleCenter = Bounds.GetCenter();
	MarbleMeshRadius = Bounds.GetExtent().GetMax();
	UE_LOG(LogTemp, Display, TEXT("FlyClock: Murmelnetz %s, Mitte %s, Radius %.1f"), *Sphere->GetName(), *MarbleCenter.ToString(), MarbleMeshRadius);

	UMaterialInterface* Glass = LoadObject<UMaterialInterface>(nullptr, MarblePath);
	Tray.Init(MarbleCount);
	for (const FMarble& Marble : Tray.GetMarbles())
	{
		UStaticMeshComponent* View = NewObject<UStaticMeshComponent>(this);
		View->SetupAttachment(Stage);
		View->SetStaticMesh(Sphere);
		View->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		View->SetRelativeScale3D(FVector(MarbleTray::Radius / MarbleMeshRadius));
		if (Glass)
		{
			UMaterialInstanceDynamic* Look = UMaterialInstanceDynamic::Create(Glass, this);
			Look->SetVectorParameterValue(TEXT("Color"), MarbleColors[Marble.Kind]);
			View->SetMaterial(0, Look);
		}
		View->RegisterComponent();
		MarbleViews.Add(View);
	}

	Clack = LoadObject<USoundWave>(nullptr, ClackPath);
	ClackFalloff = NewObject<USoundAttenuation>(this);
	ClackFalloff->Attenuation.bAttenuate = true;
	ClackFalloff->Attenuation.bSpatialize = true;
	ClackFalloff->Attenuation.AttenuationShapeExtents = FVector(8.0f);
	ClackFalloff->Attenuation.FalloffDistance = 200.0f;
}

FVector AFlyClock::DefaultView() const
{
	return bMarbles ? FVector(0.0, 46.0, 44.0) : FVector(0.0, CameraPitch, CameraDistance);
}

void AFlyClock::SetFace(bool bMarblesNow)
{
	bMarbles = bMarblesNow;
	for (AFlyActor* Visual : Visuals)
	{
		Visual->SetActorHiddenInGame(true);
	}
	for (UStaticMeshComponent* Piece : TrayParts) Piece->SetVisibility(bMarbles);
	for (UStaticMeshComponent* View : MarbleViews) View->SetVisibility(bMarbles);

	// Steinchen und Zweige, die unter oder in das Brett ragen würden, verschwinden mit ihm.
	const FVector2D Low = PanelToWorld(FVector2D(MarbleTray::MinX, MarbleTray::MaxY)) - FVector2D(RimWidth + 1.0);
	const FVector2D High = PanelToWorld(FVector2D(MarbleTray::MaxX, MarbleTray::MinY)) + FVector2D(RimWidth + 1.0);
	const FBox2D Board(Low, High);
	for (UStaticMeshComponent* Prop : Props)
	{
		const FBox Bounds = Prop->Bounds.GetBox();
		const FBox2D Flat(FVector2D(Bounds.Min.X, Bounds.Min.Y), FVector2D(Bounds.Max.X, Bounds.Max.Y));
		if (Board.Intersect(Flat)) Prop->SetVisibility(!bMarbles);
	}

	Stage->SetRelativeLocation(FVector(0.0, 0.0, bMarbles ? BoardTop : 0.0));
	ViewWanted = DefaultView();
}

void AFlyClock::StepMarbles(const FVector2D* Finger, const FDateTime& Now, float DeltaSeconds)
{
	Bank += DeltaSeconds;
	int32 Steps = 0;
	while (Bank >= StepSeconds && Steps < 5)
	{
		Tray.Update(Finger, Now.GetHour(), Now.GetMinute(), Hits);
		Bank -= StepSeconds;
		Steps++;
	}
	if (Steps == 5) Bank = 0.0;

	for (const FMarbleHit& Hit : Hits) PlayClack(Hit);
	Hits.Reset();

	const TArray<FMarble>& Marbles = Tray.GetMarbles();
	const double Scale = MarbleTray::Radius / MarbleMeshRadius;
	for (int32 i = 0; i < MarbleViews.Num(); i++)
	{
		const FMarble& Marble = Marbles[i];
		const FVector Center(FlyPanel::H / 2.0 - Marble.P.Y, Marble.P.X - FlyPanel::W / 2.0, MarbleTray::Radius);
		MarbleViews[i]->SetRelativeRotation(Marble.Q);
		MarbleViews[i]->SetRelativeLocation(Center - Marble.Q.RotateVector(MarbleCenter * Scale));
	}
}

// Wie sim/clack.js: Wucht bestimmt Lautstärke, Helligkeit und ein wenig die Tonhöhe.
// Am Holzrand klingt derselbe Stoß tiefer und dumpfer.
void AFlyClock::PlayClack(const FMarbleHit& Hit)
{
	if (!Clack || bMuted) return;
	ClackVoices.RemoveAll([](const TObjectPtr<UAudioComponent>& Voice) { return !Voice || !Voice->IsPlaying(); });
	if (ClackVoices.Num() >= 10) return;

	const float S = static_cast<float>(Hit.Strength);
	const float Volume = 0.04f + FMath::Pow(S, 1.4f) * 0.96f;
	float Pitch = 0.9f + 0.15f * S + FMath::FRandRange(-0.04f, 0.04f);
	float Cutoff = 1800.0f + S * S * 14000.0f;
	if (Hit.bRim)
	{
		Pitch *= 0.55f;
		Cutoff *= 0.35f;
	}
	const FVector2D At = PanelToWorld(Hit.P);
	UAudioComponent* Voice = UGameplayStatics::SpawnSoundAtLocation(this, Clack, FVector(At.X, At.Y, BoardTop + 0.7), FRotator::ZeroRotator, Volume, Pitch, 0.0f, ClackFalloff);
	if (!Voice) return;
	Voice->SetLowPassFilterEnabled(true);
	Voice->SetLowPassFilterFrequency(Cutoff);
	ClackVoices.Add(Voice);
}

void AFlyClock::LoadLook()
{
	UMaterialInterface* Solid = LoadObject<UMaterialInterface>(nullptr, SolidPath);
	UMaterialInterface* Wing = LoadObject<UMaterialInterface>(nullptr, WingPath);

	FFlyLook Look;
	Look.Thorax = Tint(Solid, this, FLinearColor(0.035f, 0.035f, 0.04f), 0.45f);
	Look.Abdomen = Tint(Solid, this, FLinearColor(0.06f, 0.055f, 0.045f), 0.35f);
	Look.Eye = Tint(Solid, this, FLinearColor(0.32f, 0.05f, 0.025f), 0.2f);
	Look.Leg = Tint(Solid, this, FLinearColor(0.02f, 0.02f, 0.02f), 0.6f);
	// Dunkle, fast durchsichtige Flügel: helle Flügel ließen die Fliegen auf dem hellen Boden grau wirken.
	Look.Wing = Tint(Wing, this, FLinearColor(0.3f, 0.32f, 0.36f), 0.25f, 0.14f);

	UStaticMesh* ScanMesh = nullptr;
	IAssetRegistry& Registry = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry")).Get();
	// Im Spielmodus ist die Registry beim Start noch nicht fertig durchsucht.
	Registry.ScanPathsSynchronous({ FString(ScanFolder) }, true);
	TArray<FAssetData> Found;
	Registry.GetAssetsByPath(FName(ScanFolder), Found, true);
	for (const FAssetData& Asset : Found)
	{
		if (Asset.AssetClassPath == UStaticMesh::StaticClass()->GetClassPathName())
		{
			ScanMesh = Cast<UStaticMesh>(Asset.GetAsset());
			break;
		}
	}

	for (AFlyActor* Visual : Visuals)
	{
		if (Solid) Visual->SetLook(Look);
		if (ScanMesh) Visual->UseScan(ScanMesh, ScanRotation);
	}
}

bool AFlyClock::ReadFinger(FVector2D& Out) const
{
	APlayerController* Controller = GetWorld()->GetFirstPlayerController();
	if (!Controller) return false;

	FVector Origin;
	FVector Direction;
	bool bDown = false;
	float TouchX = 0.0f;
	float TouchY = 0.0f;
	bool bTouch = false;
	Controller->GetInputTouchState(ETouchIndex::Touch1, TouchX, TouchY, bTouch);
	if (bTouch)
	{
		bDown = Controller->DeprojectScreenPositionToWorld(TouchX, TouchY, Origin, Direction);
	}
	else if (Controller->IsInputKeyDown(EKeys::LeftMouseButton))
	{
		bDown = Controller->DeprojectMousePositionToWorld(Origin, Direction);
	}
	if (!bDown || Direction.Z > -1e-4) return false;

	const double Plane = Stage->GetComponentLocation().Z;
	const FVector Hit = Origin + Direction * ((Plane - Origin.Z) / Direction.Z);
	const FVector Local = Stage->GetComponentTransform().InverseTransformPosition(Hit);
	Out = FVector2D(Local.Y + FlyPanel::W / 2.0, FlyPanel::H / 2.0 - Local.X);
	return true;
}

void AFlyClock::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (APlayerController* Controller = GetWorld()->GetFirstPlayerController())
	{
		if (Controller->WasInputKeyJustPressed(EKeys::M)) bMuted = !bMuted;
		if (Controller->WasInputKeyJustPressed(EKeys::Escape)) Controller->ConsoleCommand(TEXT("quit"));
		if (Controller->WasInputKeyJustPressed(EKeys::Tab)) SetFace(!bMarbles);
	}
	SteerView(DeltaSeconds);

	FVector2D Finger;
	const bool bFinger = ReadFinger(Finger);
	const FDateTime Now = FDateTime::Now();

	if (bMarbles)
	{
		StepMarbles(bFinger ? &Finger : nullptr, Now, DeltaSeconds);
		UpdateBuzz(DeltaSeconds);
		return;
	}

	Bank += DeltaSeconds;
	int32 Steps = 0;
	while (Bank >= StepSeconds && Steps < 5)
	{
		Airborne = Swarm.Update(bFinger ? &Finger : nullptr, Now.GetHour(), Now.GetMinute());
		Bank -= StepSeconds;
		Steps++;
	}
	if (Steps == 5) Bank = 0.0;

	const TArray<FFly>& Flies = Swarm.GetFlies();
	for (int32 i = 0; i < Visuals.Num(); i++)
	{
		Visuals[i]->ApplyPose(Flies[i], DeltaSeconds);
	}
	UpdateBuzz(DeltaSeconds);
}

// Rechte Maustaste ziehen dreht um die Ziffern, das Mausrad zoomt.
// Pfeiltasten drehen und neigen, Bild auf/ab zoomt, R stellt die Ausgangsansicht wieder her.
void AFlyClock::SteerView(float DeltaSeconds)
{
	APlayerController* Controller = GetWorld()->GetFirstPlayerController();
	if (!Controller) return;

	FVector2D Mouse;
	const bool bMouse = Controller->GetMousePosition(Mouse.X, Mouse.Y);
	if (bMouse && Controller->IsInputKeyDown(EKeys::RightMouseButton))
	{
		if (bOrbiting)
		{
			const FVector2D Delta = Mouse - LastMouse;
			ViewWanted.X += Delta.X * 0.25;
			ViewWanted.Y += Delta.Y * 0.2;
		}
		bOrbiting = true;
		LastMouse = Mouse;
	}
	else
	{
		bOrbiting = false;
	}

	const double Turn = 70.0 * DeltaSeconds;
	if (Controller->IsInputKeyDown(EKeys::Left)) ViewWanted.X -= Turn;
	if (Controller->IsInputKeyDown(EKeys::Right)) ViewWanted.X += Turn;
	if (Controller->IsInputKeyDown(EKeys::Up)) ViewWanted.Y += Turn * 0.6;
	if (Controller->IsInputKeyDown(EKeys::Down)) ViewWanted.Y -= Turn * 0.6;
	double Zoom = 1.0;
	if (Controller->WasInputKeyJustPressed(EKeys::MouseScrollUp)) Zoom *= 0.88;
	if (Controller->WasInputKeyJustPressed(EKeys::MouseScrollDown)) Zoom /= 0.88;
	if (Controller->IsInputKeyDown(EKeys::PageUp)) Zoom *= FMath::Pow(0.5, DeltaSeconds);
	if (Controller->IsInputKeyDown(EKeys::PageDown)) Zoom /= FMath::Pow(0.5, DeltaSeconds);
	ViewWanted.Z *= Zoom;
	if (Controller->WasInputKeyJustPressed(EKeys::R)) ViewWanted = DefaultView();

	// Nicht unter den Boden und nicht so weit weg, dass die Ziffern verschwinden.
	ViewWanted.Y = FMath::Clamp(ViewWanted.Y, 6.0, 89.0);
	ViewWanted.Z = FMath::Clamp(ViewWanted.Z, 4.0, 120.0);

	const double Follow = FMath::Min(1.0, DeltaSeconds * 8.0);
	ViewNow += (ViewWanted - ViewNow) * Follow;
	ApplyView();
	static int32 Debug = 0;
	if (++Debug == 1200 && FParse::Param(FCommandLine::Get(), TEXT("shot")))
	{
		Controller->ConsoleCommand(TEXT("HighResShot 1"));
	}
}

void AFlyClock::ApplyView()
{
	const double Yaw = FMath::DegreesToRadians(ViewNow.X);
	const double Pitch = FMath::DegreesToRadians(ViewNow.Y);
	const double Distance = ViewNow.Z;
	const FVector Offset(-FMath::Cos(Pitch) * FMath::Cos(Yaw), -FMath::Cos(Pitch) * FMath::Sin(Yaw), FMath::Sin(Pitch));
	Camera->SetRelativeLocation(Offset * Distance + FVector(0.0, 0.0, Stage->GetRelativeLocation().Z));
	Camera->SetRelativeRotation(FRotator(-ViewNow.Y, ViewNow.X, 0.0));
	Camera->FocusSettings.ManualFocusDistance = Distance;
	// Die Schärfentiefe schrumpft mit dem Quadrat des Abstands, nah wird daher abgeblendet.
	Camera->CurrentAperture = FMath::Clamp(Aperture * static_cast<float>(CameraDistance / Distance), 4.0f, 22.0f);
}

void AFlyClock::UpdateBuzz(float DeltaSeconds)
{
	if (!Buzz->Sound) return;
	const float Follow = FMath::Min(1.0f, DeltaSeconds * 15.0f);
	const float Target = bMuted || bMarbles || Airborne <= 0 ? 0.0f : FMath::Min(1.0f, 0.3f + Airborne * 0.05f);
	BuzzLevel += (Target - BuzzLevel) * Follow;
	Buzz->SetVolumeMultiplier(FMath::Max(BuzzLevel, 0.001f));
	Buzz->SetPitchMultiplier(0.92f + 0.16f * FMath::Min(1.0f, Airborne / 20.0f));

	const TArray<FFly>& Flies = Swarm.GetFlies();
	const int32 First = Flies.Num() - RoverBuzz.Num();
	for (int32 i = 0; i < RoverBuzz.Num(); i++)
	{
		const FFly& Fly = Flies[First + i];
		const float Want = !bMuted && !bMarbles && Fly.Mode == EFlyMode::Fly ? 1.0f : 0.0f;
		RoverLevel[i] += (Want - RoverLevel[i]) * Follow;
		RoverBuzz[i]->SetVolumeMultiplier(FMath::Max(RoverLevel[i], 0.001f));
	}
}
