#include "MarbleBox.h"

using namespace MarbleTray;

namespace
{
	// Annäherungsgeschwindigkeit in Einheiten pro Schritt, ab der ein Stoß klingt.
	constexpr double MinHit = 0.25;
	constexpr int32 HitPause = 5;
	constexpr double FingerRadius = 22.0;
	constexpr double SpotInset = Radius + 2.0;
	constexpr double SpotPitch = 2.0 * Radius + 1.0;

	double Collide(FMarble& A, FMarble& B)
	{
		const double Min = 2.0 * Radius;
		const FVector2D D = B.P - A.P;
		const double Dist = D.Size();
		if (Dist >= Min || Dist < 1e-4) return 0.0;
		const FVector2D N = D / Dist;
		const double Overlap = (Min - Dist) / 2.0;
		A.P -= N * Overlap;
		B.P += N * Overlap;
		const double Rel = FVector2D::DotProduct(A.V - B.V, N);
		if (Rel <= 0.0) return 0.0;
		const double Impulse = Rel * 0.72;
		A.V -= N * Impulse;
		B.V += N * Impulse;
		const FVector2D T(-N.Y, N.X);
		const double Tangent = FVector2D::DotProduct(A.V - B.V, T) * 0.12;
		A.V -= T * Tangent;
		B.V += T * Tangent;
		return Rel;
	}

	// Rollen ohne Gleiten. Panel-x ist Bühnen-Y, Panel-y ist Bühnen-−X, die Achse liegt waagrecht quer zur Bahn.
	void Spin(FMarble& Marble)
	{
		const double Speed = Marble.V.Size();
		if (Speed < 0.02) return;
		const FVector Axis(-Marble.V.X / Speed, -Marble.V.Y / Speed, 0.0);
		Marble.Q = FQuat(Axis, Speed / Radius) * Marble.Q;
		Marble.Q.Normalize();
	}

	double Strength(double Rel)
	{
		return FMath::Min(1.0, Rel / 4.0);
	}
}

void FMarbleBox::Init(int32 Count)
{
	Spots.Reset();
	for (double X = MinX + SpotInset; X <= MaxX - SpotInset; X += SpotPitch)
	{
		Spots.Add(FVector2D(X, MinY + SpotInset));
		Spots.Add(FVector2D(X, MaxY - SpotInset));
	}
	for (double Y = MinY + SpotInset + SpotPitch; Y <= MaxY - SpotInset - SpotPitch; Y += SpotPitch)
	{
		Spots.Add(FVector2D(MinX + SpotInset, Y));
		Spots.Add(FVector2D(MaxX - SpotInset, Y));
	}
	SpotTaken.Init(false, Spots.Num());

	TArray<int32> Order;
	for (int32 i = 0; i < Spots.Num(); i++) Order.Add(i);
	for (int32 i = Order.Num() - 1; i > 0; i--) Order.Swap(i, FMath::RandRange(0, i));

	Marbles.SetNum(FMath::Min(Count, Spots.Num()));
	for (int32 i = 0; i < Marbles.Num(); i++)
	{
		FMarble& Marble = Marbles[i];
		Marble.Kind = i % 8;
		Marble.Park = Order[i];
		SpotTaken[Marble.Park] = true;
		Marble.P = Spots[Marble.Park];
		Marble.Target = Marble.P;
		Marble.Q = FQuat(FMath::VRand(), FMath::FRand() * 2.0 * PI);
	}
}

void FMarbleBox::Update(const FVector2D* Finger, int32 Hours, int32 Minutes, TArray<FMarbleHit>& Hits)
{
	Tick++;
	const TArray<FFlySlot> Slots = MakeStackedSlots(Hours, Minutes);
	const FString Key = FString::Printf(TEXT("%d:%d"), Hours, Minutes);
	if (Key != Stamp)
	{
		Stamp = Key;
		if (Loose <= 0) SyncStable(Slots);
	}

	if (Finger)
	{
		Push(*Finger, bHadFinger ? *Finger - LastFinger : FVector2D::ZeroVector);
		LastFinger = *Finger;
	}
	bHadFinger = Finger != nullptr;
	if (Loose > 0) Loose--;
	if (bWasLoose && Loose == 0) SyncNearest(Slots);
	bWasLoose = Loose > 0;

	for (FMarble& Marble : Marbles)
	{
		const double Magnet = Loose > 0 ? 0.0002 : Marble.Park != INDEX_NONE ? 0.003 : 0.0022;
		Marble.V += (Marble.Target - Marble.P) * Magnet;
		Marble.V *= 0.978;
	}

	for (int32 i = 0; i < Marbles.Num(); i++)
	{
		for (int32 j = i + 1; j < Marbles.Num(); j++)
		{
			FMarble& A = Marbles[i];
			FMarble& B = Marbles[j];
			const double Rel = Collide(A, B);
			// Ruhendes Aneinanderliegen erzeugt winzige Stöße, die stumm bleiben.
			if (Rel < MinHit || Tick - A.HitAt < HitPause || Tick - B.HitAt < HitPause) continue;
			A.HitAt = Tick;
			B.HitAt = Tick;
			Hits.Add({ (A.P + B.P) / 2.0, Strength(Rel), false });
		}
	}

	for (FMarble& Marble : Marbles)
	{
		Marble.P += Marble.V;
		Spin(Marble);
		const double Impact = KeepInside(Marble);
		if (Impact >= MinHit && Tick - Marble.HitAt >= HitPause)
		{
			Marble.HitAt = Tick;
			Hits.Add({ Marble.P, Strength(Impact), true });
		}
		if (Loose == 0 && FVector2D::DistSquared(Marble.Target, Marble.P) < 16.0)
		{
			Marble.V *= 0.82;
		}
	}
}

void FMarbleBox::SyncStable(const TArray<FFlySlot>& Slots)
{
	TSet<FString> Taken;
	for (FMarble& Marble : Marbles)
	{
		if (Marble.SlotId.IsEmpty()) continue;
		const FFlySlot* Slot = Slots.FindByPredicate([&](const FFlySlot& Item) { return Item.Id == Marble.SlotId; });
		if (!Slot)
		{
			Marble.SlotId.Empty();
			continue;
		}
		Taken.Add(Slot->Id);
		Marble.Target = Slot->P;
	}
	// Frei gewordene Murmeln zuerst zurück an den Rand, damit die Lücken nicht im Weg liegen.
	ParkRest();
	for (const FFlySlot& Slot : Slots)
	{
		if (Taken.Contains(Slot.Id)) continue;
		FMarble* Best = nullptr;
		double BestDist = TNumericLimits<double>::Max();
		for (FMarble& Marble : Marbles)
		{
			if (!Marble.SlotId.IsEmpty()) continue;
			const double Dist = FVector2D::DistSquared(Marble.P, Slot.P);
			if (Dist < BestDist)
			{
				BestDist = Dist;
				Best = &Marble;
			}
		}
		if (Best) Assign(*Best, Slot);
	}
}

void FMarbleBox::SyncNearest(const TArray<FFlySlot>& Slots)
{
	for (FMarble& Marble : Marbles)
	{
		Marble.SlotId.Empty();
		Marble.Park = INDEX_NONE;
	}
	SpotTaken.Init(false, Spots.Num());

	struct FPair
	{
		double Dist;
		int32 Slot;
		int32 Marble;
	};
	TArray<FPair> Pairs;
	for (int32 s = 0; s < Slots.Num(); s++)
	{
		for (int32 m = 0; m < Marbles.Num(); m++)
		{
			Pairs.Add({ FVector2D::DistSquared(Marbles[m].P, Slots[s].P), s, m });
		}
	}
	Pairs.Sort([](const FPair& A, const FPair& B) { return A.Dist < B.Dist; });
	TArray<bool> SlotUsed;
	SlotUsed.Init(false, Slots.Num());
	for (const FPair& Pair : Pairs)
	{
		if (SlotUsed[Pair.Slot] || !Marbles[Pair.Marble].SlotId.IsEmpty()) continue;
		SlotUsed[Pair.Slot] = true;
		Assign(Marbles[Pair.Marble], Slots[Pair.Slot]);
	}
	ParkRest();
}

void FMarbleBox::Assign(FMarble& Marble, const FFlySlot& Slot)
{
	if (Marble.Park != INDEX_NONE)
	{
		SpotTaken[Marble.Park] = false;
		Marble.Park = INDEX_NONE;
	}
	Marble.SlotId = Slot.Id;
	Marble.Target = Slot.P;
}

void FMarbleBox::ParkRest()
{
	for (FMarble& Marble : Marbles)
	{
		if (!Marble.SlotId.IsEmpty() || Marble.Park != INDEX_NONE) continue;
		int32 Best = INDEX_NONE;
		double BestDist = TNumericLimits<double>::Max();
		for (int32 i = 0; i < Spots.Num(); i++)
		{
			if (SpotTaken[i]) continue;
			const double Dist = FVector2D::DistSquared(Marble.P, Spots[i]);
			if (Dist < BestDist)
			{
				BestDist = Dist;
				Best = i;
			}
		}
		if (Best == INDEX_NONE) continue;
		SpotTaken[Best] = true;
		Marble.Park = Best;
		Marble.Target = Spots[Best];
	}
}

// Der Finger ist eine Scheibe, die Murmeln wegschiebt. Schnelles Wischen bringt alles durcheinander.
void FMarbleBox::Push(const FVector2D& Finger, const FVector2D& FingerV)
{
	const double Reach = Radius + FingerRadius;
	for (FMarble& Marble : Marbles)
	{
		const FVector2D D = Marble.P - Finger;
		const double Dist = D.Size();
		if (Dist >= Reach) continue;
		const FVector2D N = Dist > 1e-4 ? D / Dist : FVector2D(1.0, 0.0);
		Marble.P = Finger + N * Reach;
		const double Rel = FVector2D::DotProduct(FingerV - Marble.V, N);
		if (Rel > 0.0) Marble.V += N * Rel * 1.2;
		if (FingerV.Size() > 3.0) Loose = 42;
	}
}

double FMarbleBox::KeepInside(FMarble& Marble)
{
	double Impact = 0.0;
	auto Wall = [&](double& Pos, double& Speed, double& Across, double Min, double Max)
	{
		if (Pos >= Min && Pos <= Max) return;
		const double Into = Pos < Min ? -Speed : Speed;
		Pos = FMath::Clamp(Pos, Min, Max);
		if (Into > 0.0)
		{
			Impact = FMath::Max(Impact, Into);
			Speed *= -0.4;
		}
		Across *= 0.92;
	};
	Wall(Marble.P.X, Marble.V.X, Marble.V.Y, MinX + Radius, MaxX - Radius);
	Wall(Marble.P.Y, Marble.V.Y, Marble.V.X, MinY + Radius, MaxY - Radius);
	return Impact;
}
