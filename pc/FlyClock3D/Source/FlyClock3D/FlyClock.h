#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FlySwarm.h"
#include "MarbleBox.h"
#include "FlyClock.generated.h"

class AFlyActor;
class UAudioComponent;
class UCineCameraComponent;
class UDirectionalLightComponent;
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

private:
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

	UPROPERTY()
	TObjectPtr<USoundWave> Clack;

	UPROPERTY()
	TObjectPtr<USoundAttenuation> ClackFalloff;

	UPROPERTY()
	TArray<TObjectPtr<UAudioComponent>> ClackVoices;

	FMarbleBox Tray;
	bool bMarbles = false;
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

	// Blickwinkel in Grad und Abstand in Zentimetern, jeweils Ziel und geglätteter Ist-Wert.
	FVector ViewWanted = FVector::ZeroVector;
	FVector ViewNow = FVector::ZeroVector;
	FVector2D LastMouse = FVector2D::ZeroVector;
	bool bOrbiting = false;

	bool ReadFinger(FVector2D& Out) const;
	void SteerView(float DeltaSeconds);
	void ApplyView();
	void HideMapContent();
	void BuildForest();
	void Place(const TCHAR* Folder, const TCHAR* Name, const FVector2D& At, double Yaw, double Scale, double Sink);
	void LoadLook();
	void UpdateBuzz(float DeltaSeconds);
	void BuildTray();
	void SetFace(bool bMarblesNow);
	FVector DefaultView() const;
	void StepMarbles(const FVector2D* Finger, const FDateTime& Now, float DeltaSeconds);
	void PlayClack(const FMarbleHit& Hit);
};
