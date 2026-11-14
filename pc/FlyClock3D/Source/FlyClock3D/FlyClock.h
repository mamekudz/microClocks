#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FlySwarm.h"
#include "MarbleBox.h"
#include "FlyClock.generated.h"

class AFlyActor;
class UAudioComponent;
class UCanvas;
class UCineCameraComponent;
class UDirectionalLightComponent;
class UMaterialInterface;
class USkyLightComponent;
class USoundAttenuation;
class USoundWave;
class UStaticMesh;
class UStaticMeshComponent;

UCLASS()
class AFlyClock : public AActor
{
	GENERATED_BODY()

public:
	AFlyClock();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	// Knopfleiste, gezeichnet vom HUD. Wallpaper Engine reicht Programm-Wallpapers nur Maus und linke Taste durch.
	void DrawOverlay(UCanvas* Canvas);

private:
	enum class EButton : uint8 { Face, Ground, Digits, TurnLeft, TurnRight, Flatter, Steeper, Closer, Farther, Reset, Sound, Slot1, Slot2, Slot3 };
	UPROPERTY(VisibleAnywhere)
	TObjectPtr<USceneComponent> Root;

	// Trägt die Fliegen in Panel-Einheiten, verkleinert auf echte Fliegengröße.
	UPROPERTY(VisibleAnywhere)
	TObjectPtr<USceneComponent> Stage;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<UStaticMeshComponent> Ground;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<UStaticMeshComponent> Dome;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<UCineCameraComponent> Camera;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<UDirectionalLightComponent> Sun;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<USkyLightComponent> Sky;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<UAudioComponent> Buzz;

	UPROPERTY()
	TArray<TObjectPtr<AFlyActor>> Visuals;

	UPROPERTY()
	TArray<TObjectPtr<UAudioComponent>> RoverBuzz;

	UPROPERTY()
	TArray<TObjectPtr<UStaticMeshComponent>> Props;

	// Zweites Zifferblatt: Oxyd-Murmeln auf einem Eichenbrett mit Rand.
	UPROPERTY()
	TArray<TObjectPtr<UStaticMeshComponent>> TrayParts;

	UPROPERTY()
	TArray<TObjectPtr<UStaticMeshComponent>> MarbleViews;

	// Je Murmel ein Oxyd-Stein- und ein Glasmaterial; SetFace wählt.
	UPROPERTY()
	TArray<TObjectPtr<UMaterialInterface>> StoneLooks;

	UPROPERTY()
	TArray<TObjectPtr<UMaterialInterface>> GlassLooks;

	UPROPERTY()
	TObjectPtr<USoundWave> Clack;

	UPROPERTY()
	TObjectPtr<USoundAttenuation> ClackFalloff;

	UPROPERTY()
	TArray<TObjectPtr<UAudioComponent>> ClackVoices;

	// Untergründe in der Reihenfolge von GroundNames in FlyClock.cpp; null, wenn nicht eingerichtet.
	UPROPERTY()
	TArray<TObjectPtr<UMaterialInterface>> GroundLooks;

	int32 GroundIndex = 0;
	// Ziffernraster der Fliegen, siehe MakeClockSlots.
	int32 DigitSize = 0;

	FMarbleBox Tray;
	bool bMarbles = false;
	// Nur mit bMarbles: Glasmurmeln statt Oxyd-Steinen.
	bool bGlass = false;
	TArray<FMarbleHit> Hits;
	// Mittelpunkt und Radius der Kugel im Netz, damit sie um ihre Mitte rollt.
	FVector MarbleCenter = FVector::ZeroVector;
	double MarbleMeshRadius = 50.0;

	FFlySwarm Swarm;
	double Bank = 0.0;
	int32 Airborne = 0;
	float BuzzLevel = 0.0f;
	TArray<float> RoverLevel;
	bool bMuted = false;
	// Lautstärkestufe 0 = aus bis 3 = laut; Wallpaper Engine bietet Programm-Wallpapers keinen Regler.
	int32 SoundLevel = 2;
	void SetSoundLevel(int32 Level);

	// Blickwinkel in Grad und Abstand in Zentimetern, jeweils Ziel und geglätteter Ist-Wert.
	FVector ViewWanted = FVector::ZeroVector;
	FVector ViewNow = FVector::ZeroVector;
	FVector2D LastMouse = FVector2D::ZeroVector;
	bool bOrbiting = false;
	// Gemerkte Ansicht je Zifferblatt: Fliegen, Murmeln.
	FVector Views[2];

	// Als Wallpaper (Programmname microClocks-…) gilt die gespeicherte Einstellung.
	bool bWallpaper = false;
	// microClocks-flies.exe zeigt nur die Fliegen, microClocks-oxyd.exe nur Steine und Glasmurmeln.
	enum class EFaces : uint8 { All, Flies, Oxyd };
	EFaces Faces = EFaces::All;
	// Abschnitt in GameUserSettings.ini, je Wallpaper eigener.
	FString SettingsSection = TEXT("microClocks");	// Mauszeiger in Fensterpixeln, zuletzt bewegt zur Echtzeit LastMove.
	FVector2D Cursor = FVector2D::ZeroVector;
	bool bCursor = false;
	bool bCursorDown = false;
	double LastMove = -100.0;
	float OverlayAlpha = 0.0f;
	// Knöpfe aus dem letzten gezeichneten Bild; Pressed ist der gerade gehaltene.
	TArray<TPair<EButton, FBox2D>> ButtonBoxes;
	FBox2D OverlayBox = FBox2D(ForceInit);
	TOptional<EButton> Pressed;
	// Speicherplätze: Klick ruft ab, 1 s Halten speichert Uhr, Boden, Ziffern, Ton und Ansicht.
	float HeldFor = 0.0f;
	bool bSlotStored = false;
	int32 StoredSlot = -1;
	double StoredUntil = 0.0;
	static int32 SlotIndex(EButton Button);
	FString SlotKey(int32 Slot) const;
	void StoreSlot(int32 Slot);
	void RecallSlot(int32 Slot);

	bool ReadCursor(FVector2D& Out, bool& bDown) const;
	bool ReadFinger(const FVector2D& Screen, FVector2D& Out) const;
	void UpdatePointer(double Now, float DeltaSeconds);
	TOptional<EButton> ButtonAt(const FVector2D& At) const;
	void HoldButton(EButton Button, float DeltaSeconds);
	void ClickButton(EButton Button);
	FString ButtonLabel(EButton Button) const;
	static FString SlotLabel(int32 Slot, bool bFilled);
	void LoadSettings();
	void SaveSettings();
	void SteerView(float DeltaSeconds);
	void ApplyView();
	void HideMapContent();
	void BuildForest();
	void Place(const TCHAR* Folder, const TCHAR* Name, const FVector2D& At, double Yaw, double Scale, double Sink);
	void LoadLook();
	void UpdateBuzz(float DeltaSeconds);
	void BuildTray();
	void SetFace(bool bMarblesNow, bool bGlassNow);
	void NextFace();
	void SetGround(int32 Index);
	void SetDigitSize(int32 Size);
	void UpdateProps();
	static FVector DefaultView(bool bForMarbles);
	void StepMarbles(const FVector2D* Finger, const FDateTime& Now, float DeltaSeconds);
	void PlayClack(const FMarbleHit& Hit);
};
