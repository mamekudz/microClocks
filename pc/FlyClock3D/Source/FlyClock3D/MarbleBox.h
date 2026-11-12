#pragma once

#include "CoreMinimal.h"
#include "FlySwarm.h"

// Innenmaß des Murmelbretts in Panel-Einheiten, etwas größer als das Panel.
namespace MarbleTray
{
	constexpr double MinX = -60.0;
	constexpr double MaxX = FlyPanel::W + 60.0;
	constexpr double MinY = -50.0;
	constexpr double MaxY = FlyPanel::H + 50.0;
	constexpr double Radius = 15.0;
}

struct FMarble
{
	FVector2D P = FVector2D::ZeroVector;
	FVector2D V = FVector2D::ZeroVector;
	// Rollt die Kugel, dreht sich dieses Quaternion im Rahmen der Bühne mit.
	FQuat Q = FQuat::Identity;
	FString SlotId;
	int32 Park = INDEX_NONE;
	FVector2D Target = FVector2D::ZeroVector;
	int32 HitAt = -1000;
	int32 Kind = 0;
};

struct FMarbleHit
{
	FVector2D P = FVector2D::ZeroVector;
	// 0 bis 1, ab 4 Einheiten pro Schritt Annäherung voller Stoß.
	double Strength = 0.0;
	bool bRim = false;
};

// Wie sim/marbles.js mit Oxyd-Boden, nur dass übrige Murmeln am Rand parken statt zu verschwinden.
// Ein Schritt entspricht einem Bild bei 60 Hz.
class FMarbleBox
{
public:
	void Init(int32 Count);
	void Update(const FVector2D* Finger, int32 Hours, int32 Minutes, TArray<FMarbleHit>& Hits);
	const TArray<FMarble>& GetMarbles() const { return Marbles; }

private:
	TArray<FMarble> Marbles;
	TArray<FVector2D> Spots;
	TArray<bool> SpotTaken;
	FString Stamp;
	int32 Loose = 0;
	bool bWasLoose = false;
	int32 Tick = 0;
	bool bHadFinger = false;
	FVector2D LastFinger = FVector2D::ZeroVector;

	void SyncStable(const TArray<FFlySlot>& Slots);
	void SyncNearest(const TArray<FFlySlot>& Slots);
	void Assign(FMarble& Marble, const FFlySlot& Slot);
	void ParkRest();
	void Push(const FVector2D& Finger, const FVector2D& FingerV);
	// Liefert die Aufprallgeschwindigkeit am Rand, 0 ohne Berührung.
	double KeepInside(FMarble& Marble);
};
