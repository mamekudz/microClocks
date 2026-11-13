#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FlyActor.generated.h"

struct FFly;
class UStaticMesh;
class UStaticMeshComponent;
class UMaterialInterface;

struct FFlyLook
{
	UMaterialInterface* Thorax = nullptr;
	UMaterialInterface* Abdomen = nullptr;
	UMaterialInterface* Eye = nullptr;
	UMaterialInterface* Leg = nullptr;
	UMaterialInterface* Wing = nullptr;
};

UCLASS()
class AFlyActor : public AActor
{
	GENERATED_BODY()

public:
	AFlyActor();

	void SetLook(const FFlyLook& Look);
	void UseScan(UStaticMesh* Mesh, const FRotator& Rotation);
	void ApplyPose(const FFly& Fly, float DeltaSeconds);

private:
	UPROPERTY()
	TObjectPtr<USceneComponent> Root;

	UPROPERTY()
	TObjectPtr<USceneComponent> Body;

	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> Thorax;

	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> Head;

	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> Abdomen;

	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> EyeL;

	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> EyeR;

	UPROPERTY()
	TObjectPtr<USceneComponent> ProboscisHinge;

	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> Proboscis;

	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> Scan;

	UPROPERTY()
	TArray<TObjectPtr<USceneComponent>> Hips;

	UPROPERTY()
	TArray<TObjectPtr<UStaticMeshComponent>> Legs;

	UPROPERTY()
	TArray<TObjectPtr<USceneComponent>> Hinges;

	UPROPERTY()
	TArray<TObjectPtr<UStaticMeshComponent>> Wings;

	bool bScan = false;
	double WingPhase = 0.0;
	double ProboscisNow = 0.0;
	// Beinbewegung des Scans.
	FVector2D LastP = FVector2D::ZeroVector;
	double LastYaw = 0.0;
	bool bTracked = false;
	double StepPhase = 0.0;
	float WalkNow = 0.0f;
	float TurnNow = 0.0f;
	double ScanWingPhase = 0.0;
	float WingOpen = 0.0f;

	UStaticMeshComponent* MakePart(FName Name, UStaticMesh* Mesh, USceneComponent* Parent, const FVector& Location, const FVector& Scale);
};
