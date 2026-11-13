#include "FlyActor.h"

#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "FlySwarm.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	// Rumpfmitte über dem Boden, wenn die Fliege steht. Körperlänge etwa 16 Einheiten.
	constexpr double RideHeight = 4.4;
	constexpr double LegLength = 7.5;
	constexpr double WingLength = 9.0;
	constexpr double ScanLength = 16.0;
	// Weg pro Schrittzyklus des Scans: die Fußspitze schwingt in M_FlyScan ±0,9 Netzeinheiten (LEG_REACH in
	// setup_assets.py), bei 4,8 Einheiten pro Netzeinheit also ±4,3; aufgesetzt schiebt sie den Rumpf um das Doppelte.
	constexpr double Stride = 17.3;
	// Abstand der Füße von der Drehachse; beim Drehen auf der Stelle legen sie diesen Bogen zurück.
	constexpr double FootRadius = 7.0;
	// Etwas größer als das Panel-Raster (18 Einheiten) vorsieht, damit die Ziffern geschlossener wirken.
	constexpr double FlyScale = 1.2;
}

AFlyActor::AFlyActor()
{
	PrimaryActorTick.bCanEverTick = false;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderMesh(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> PlaneMesh(TEXT("/Engine/BasicShapes/Plane.Plane"));

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	Root->SetMobility(EComponentMobility::Movable);
	RootComponent = Root;

	Body = CreateDefaultSubobject<USceneComponent>(TEXT("Body"));
	Body->SetupAttachment(Root);

	UStaticMesh* Sphere = SphereMesh.Object;
	UStaticMesh* Cylinder = CylinderMesh.Object;
	UStaticMesh* Plane = PlaneMesh.Object;

	// Grundformen haben 100 Einheiten Durchmesser, daher die kleinen Maßstäbe.
	Thorax = MakePart(TEXT("Thorax"), Sphere, Body, FVector(0.0, 0.0, 0.0), FVector(0.065, 0.055, 0.05));
	Head = MakePart(TEXT("Head"), Sphere, Body, FVector(4.6, 0.0, 0.3), FVector(0.035, 0.055, 0.045));
	EyeL = MakePart(TEXT("EyeL"), Sphere, Body, FVector(5.0, -2.1, 0.7), FVector(0.032, 0.026, 0.04));
	EyeR = MakePart(TEXT("EyeR"), Sphere, Body, FVector(5.0, 2.1, 0.7), FVector(0.032, 0.026, 0.04));
	Abdomen = MakePart(TEXT("Abdomen"), Sphere, Body, FVector(-5.2, 0.0, -0.2), FVector(0.085, 0.065, 0.042));

	ProboscisHinge = CreateDefaultSubobject<USceneComponent>(TEXT("ProboscisHinge"));
	ProboscisHinge->SetupAttachment(Body);
	ProboscisHinge->SetRelativeLocation(FVector(5.4, 0.0, -1.4));
	ProboscisHinge->SetRelativeRotation(FRotationMatrix::MakeFromZ(-FVector(0.4, 0.0, -1.0).GetSafeNormal()).Rotator());
	Proboscis = MakePart(TEXT("Proboscis"), Cylinder, ProboscisHinge, FVector(0.0, 0.0, -0.6), FVector(0.008, 0.008, 0.012));

	Scan = MakePart(TEXT("Scan"), nullptr, Body, FVector::ZeroVector, FVector::OneVector);
	Scan->SetVisibility(false);

	for (int32 Side = 0; Side < 2; Side++)
	{
		const double S = Side == 0 ? -1.0 : 1.0;
		for (int32 Pair = 0; Pair < 3; Pair++)
		{
			const int32 Index = Side * 3 + Pair;
			USceneComponent* Hip = CreateDefaultSubobject<USceneComponent>(*FString::Printf(TEXT("Hip%d"), Index));
			Hip->SetupAttachment(Body);
			Hip->SetRelativeLocation(FVector(2.0 - Pair * 2.0, S * 1.8, -1.2));
			Hips.Add(Hip);
			Legs.Add(MakePart(*FString::Printf(TEXT("Leg%d"), Index), Cylinder, Hip,
				FVector(0.0, 0.0, -LegLength / 2.0), FVector(0.006, 0.006, LegLength / 100.0)));
		}

		USceneComponent* Hinge = CreateDefaultSubobject<USceneComponent>(*FString::Printf(TEXT("Hinge%d"), Side));
		Hinge->SetupAttachment(Body);
		Hinge->SetRelativeLocation(FVector(0.6, S * 1.0, 2.2));
		Hinges.Add(Hinge);
		UStaticMeshComponent* Wing = MakePart(*FString::Printf(TEXT("Wing%d"), Side), Plane, Hinge,
			FVector(WingLength / 2.0, 0.0, 0.0), FVector(WingLength / 100.0, 0.036, 1.0));
		Wing->CastShadow = true;
		Wing->bCastHiddenShadow = false;
		Wings.Add(Wing);
	}
}

UStaticMeshComponent* AFlyActor::MakePart(FName Name, UStaticMesh* Mesh, USceneComponent* Parent, const FVector& Location, const FVector& Scale)
{
	UStaticMeshComponent* Part = CreateDefaultSubobject<UStaticMeshComponent>(Name);
	Part->SetupAttachment(Parent);
	if (Mesh) Part->SetStaticMesh(Mesh);
	Part->SetRelativeLocation(Location);
	Part->SetRelativeScale3D(Scale);
	Part->SetMobility(EComponentMobility::Movable);
	Part->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Part->SetGenerateOverlapEvents(false);
	Part->CastShadow = true;
	Part->bCastDynamicShadow = true;
	return Part;
}

void AFlyActor::SetLook(const FFlyLook& Look)
{
	Thorax->SetMaterial(0, Look.Thorax);
	Head->SetMaterial(0, Look.Thorax);
	Abdomen->SetMaterial(0, Look.Abdomen);
	EyeL->SetMaterial(0, Look.Eye);
	EyeR->SetMaterial(0, Look.Eye);
	Proboscis->SetMaterial(0, Look.Leg);
	for (UStaticMeshComponent* Leg : Legs) Leg->SetMaterial(0, Look.Leg);
	for (UStaticMeshComponent* Wing : Wings) Wing->SetMaterial(0, Look.Wing);
}

void AFlyActor::UseScan(UStaticMesh* Mesh, const FRotator& Rotation)
{
	if (!Mesh) return;
	bScan = true;
	Scan->SetStaticMesh(Mesh);
	const FBox Box = Mesh->GetBoundingBox();
	const FVector Size = Box.GetSize();
	const double Longest = FMath::Max3(Size.X, Size.Y, Size.Z);
	const double Scale = Longest > KINDA_SMALL_NUMBER ? ScanLength / Longest : 1.0;
	Scan->SetRelativeRotation(Rotation);
	Scan->SetRelativeScale3D(FVector(Scale));
	Scan->SetRelativeLocation(-Rotation.RotateVector(Box.GetCenter() * Scale));
	Scan->SetVisibility(true);
	const TArray<UStaticMeshComponent*> Parts = { Thorax.Get(), Head.Get(), Abdomen.Get(), EyeL.Get(), EyeR.Get(), Proboscis.Get() };
	for (UStaticMeshComponent* Part : Parts)
	{
		Part->SetVisibility(false);
	}
	for (UStaticMeshComponent* Leg : Legs) Leg->SetVisibility(false);
}

void AFlyActor::ApplyPose(const FFly& Fly, float DeltaSeconds)
{
	SetActorHiddenInGame(!Fly.bActive);
	if (!Fly.bActive) return;

	// Panel x nach rechts wird Welt +Y, Panel y nach unten wird Welt −X. Die Kamera schaut von oben.
	const bool bAir = Fly.Mode == EFlyMode::Fly || Fly.Z > 0.5;
	SetActorRelativeScale3D(FVector(FlyScale));
	SetActorRelativeLocation(FVector(FlyPanel::H / 2.0 - Fly.P.Y, Fly.P.X - FlyPanel::W / 2.0, Fly.Z + RideHeight * FlyScale));
	const double Yaw = FMath::RadiansToDegrees(Fly.Yaw) + 90.0;
	const double Pitch = bAir ? FMath::Clamp(Fly.VZ * 5.0, -25.0, 25.0) : 0.0;
	const double Roll = FMath::RadiansToDegrees(Fly.Bank) * 0.6;
	SetActorRelativeRotation(FRotator(Pitch, Yaw, Roll));

	// Dreifuß-Gang: vorn links, Mitte rechts und hinten links schwingen gemeinsam.
	for (int32 Index = 0; Index < Hips.Num(); Index++)
	{
		const double S = Index < 3 ? -1.0 : 1.0;
		const int32 Pair = Index % 3;
		const double Forward = (1 - Pair) * 0.7;
		FVector Dir;
		if (Fly.Mode == EFlyMode::Fly)
		{
			Dir = FVector(Forward * 0.4 - 0.5, S * 0.45, -1.0);
		}
		else
		{
			const int32 Group = ((Pair % 2 == 0) == (S < 0.0)) ? 0 : 1;
			const double Swing = Fly.bStepping ? FMath::Sin(Fly.Anim * 1.6 + Group * PI) * 0.35 : 0.0;
			Dir = FVector(Forward + Swing, S * 1.1, -0.6);
		}
		Hips[Index]->SetRelativeRotation(FRotationMatrix::MakeFromZ(-Dir.GetSafeNormal()).Rotator());
	}

	const bool bFlap = Fly.Mode == EFlyMode::Fly || Fly.Z > 1.0;
	if (bFlap) WingPhase += DeltaSeconds * 2.0 * PI * 26.0;
	for (int32 Side = 0; Side < Hinges.Num(); Side++)
	{
		const double S = Side == 0 ? -1.0 : 1.0;
		FVector Dir;
		FVector Up;
		if (bFlap)
		{
			const double Flap = FMath::Sin(WingPhase) * 1.0;
			Dir = FVector(0.15, S * FMath::Cos(Flap), FMath::Sin(Flap));
			Up = FVector(0.0, -S * FMath::Sin(Flap), FMath::Cos(Flap));
		}
		else
		{
			Dir = FVector(-1.0, S * 0.32, 0.1);
			Up = FVector(0.0, 0.0, 1.0);
		}
		Hinges[Side]->SetRelativeRotation(FRotationMatrix::MakeFromXZ(Dir.GetSafeNormal(), Up).Rotator());
		Wings[Side]->SetVisibility(!bScan);
	}

	if (bScan)
	{
		// M_FlyScan bewegt Beine und Flügel über Custom Primitive Data: 0 = Schrittphase, 1 = Laufen,
		// 2 = Flügelschlagphase, 3 = Drehen (positiv nach rechts), 4 = Flügel offen. Die Schrittphase folgt
		// dem zurückgelegten Weg, damit die Füße beim Laufen und Drehen nicht rutschen.
		double Moved = 0.0;
		double Turned = 0.0;
		if (bTracked && !bAir)
		{
			Moved = FVector2D::Distance(Fly.P, LastP);
			Turned = FMath::FindDeltaAngleRadians(LastYaw, Fly.Yaw);
			// Sprünge (Neuanordnung, Rückkehr nach dem Wegfliegen) sind kein Laufen.
			if (Moved > 4.0) Moved = 0.0;
		}
		LastP = Fly.P;
		LastYaw = Fly.Yaw;
		bTracked = true;
		const double Arc = FMath::Abs(Turned) * FootRadius;
		const double Travel = Moved + Arc;
		StepPhase = FMath::Fmod(StepPhase + Travel / Stride * 2.0 * PI, 2.0 * PI);
		const bool bMoving = Travel > 0.005 * FMath::Max(DeltaSeconds * 60.0f, 1.0f);
		const float WalkWanted = bMoving ? static_cast<float>(Moved / Travel) : 0.0f;
		const float TurnWanted = bMoving ? static_cast<float>(FMath::Sign(Turned) * Arc / Travel) : 0.0f;
		// Beim Anhalten setzen die Beine in gut 0,2 s auf.
		WalkNow = FMath::FInterpConstantTo(WalkNow, WalkWanted, DeltaSeconds, 5.0f);
		TurnNow = FMath::FInterpConstantTo(TurnNow, TurnWanted, DeltaSeconds, 5.0f);
		Scan->SetCustomPrimitiveDataFloat(0, static_cast<float>(StepPhase));
		Scan->SetCustomPrimitiveDataFloat(1, WalkNow);
		// Echte Fliegen schlagen rund 200-mal pro Sekunde, man sieht nur ein Flirren. Ein langsamer, sichtbarer
		// Schlag wirkt wie ein Vogel; darum springt die Phase je Bild um den goldenen Winkel, so landet jedes Bild
		// an einer anderen Stelle des Bogens. Beim Landen legen sich die Flügel in gut 0,1 s an.
		WingOpen = FMath::FInterpConstantTo(WingOpen, bFlap ? 1.0f : 0.0f, DeltaSeconds, 8.0f);
		if (WingOpen > 0.0f) ScanWingPhase = FMath::Fmod(ScanWingPhase + 2.39996, 2.0 * PI);
		Scan->SetCustomPrimitiveDataFloat(2, static_cast<float>(ScanWingPhase));
		Scan->SetCustomPrimitiveDataFloat(3, TurnNow);
		Scan->SetCustomPrimitiveDataFloat(4, WingOpen);	}
	else
	{
		ProboscisNow += (Fly.Proboscis - ProboscisNow) * FMath::Min(1.0, DeltaSeconds * 12.0);
		const double Length = 1.2 + 2.6 * ProboscisNow;
		Proboscis->SetRelativeScale3D(FVector(0.008, 0.008, Length / 100.0));
		Proboscis->SetRelativeLocation(FVector(0.0, 0.0, -Length / 2.0));
	}
}
