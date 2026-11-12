#pragma once

#include "CoreMinimal.h"

// Panelkoordinaten wie im Browser-Simulator: x nach rechts, y nach unten, in Pixeln.
namespace FlyPanel
{
	constexpr double W = 410.0;
	constexpr double H = 502.0;
}

struct FFlySlot
{
	FString Id;
	FVector2D P = FVector2D::ZeroVector;
};

TArray<FFlySlot> MakeClockSlots(int32 Hours, int32 Minutes);
TArray<FFlySlot> MakeStackedSlots(int32 Hours, int32 Minutes);

enum class EFlyMode : uint8
{
	Off,
	Fly,
	Walk,
	Idle
};

enum class EIdleKind : uint8
{
	Stand,
	Proboscis,
	Turn,
	Pace
};

struct FFlyIdle
{
	EIdleKind Kind = EIdleKind::Stand;
	int32 Left = 0;
	int32 Tick = 0;
	int32 Steps = 0;
	int32 DirStep = 1;
	int32 Pause = 0;
	bool bOut = true;
	double HomeYaw = 0.0;
	FVector2D Origin = FVector2D::ZeroVector;
};

struct FFly
{
	bool bActive = false;
	FVector2D P = FVector2D::ZeroVector;
	FVector2D V = FVector2D::ZeroVector;
	double Z = 0.0;
	double VZ = 0.0;
	double Cruise = 40.0;
	FString SlotId;
	bool bHasGoal = false;
	FVector2D Goal = FVector2D::ZeroVector;
	bool bHasExit = false;
	FVector2D Exit = FVector2D::ZeroVector;
	bool bHasLand = false;
	FVector2D Land = FVector2D::ZeroVector;
	EFlyMode Mode = EFlyMode::Off;
	double Yaw = 0.0;
	double TargetYaw = 0.0;
	double Bank = 0.0;
	double Anim = 0.0;
	double Phase = 0.0;
	bool bStepping = false;
	bool bHasIdle = false;
	FFlyIdle Idle;
	TArray<FVector2D> Route;
	int32 Hop = 0;
	double Nerve = 0.0;
	bool bAlarmed = false;
	int32 Hesitate = 0;
	bool bLeaving = false;
	double Proboscis = 0.0;
	// Freie Fliegen gehören zu keiner Ziffer. Sie kreisen, landen irgendwo und starten wieder.
	bool bRover = false;
	int32 Rest = 0;
};

// Ein Schritt entspricht einem Bild bei 60 Hz, wie im Browser-Simulator.
class FFlySwarm
{
public:
	void Init(int32 Pool, int32 Rovers);
	int32 Update(const FVector2D* Finger, int32 Hours, int32 Minutes);
	const TArray<FFly>& GetFlies() const { return Flies; }

private:
	TArray<FFly> Flies;
	FString Stamp;

	void Sync(const TArray<FFlySlot>& Slots);
	void Spawn(FFly& Fly, const FFlySlot& Slot);
	void StartExit(FFly& Fly);
	void Scare(FFly& Fly, const FVector2D& Finger);
	void StepMove(FFly& Fly);
	void SteerFly(FFly& Fly, const FVector2D& Delta, double Dist, double Speed);
	void StepIdle(FFly& Fly);
	void BeginIdle(FFly& Fly);
	void Settle(FFly& Fly);
	void StepExit(FFly& Fly);
	void Separate(FFly& Fly);
	void Sortie(FFly& Fly);
	void StepRover(FFly& Fly);
	void TakeOff(FFly& Fly);
};
