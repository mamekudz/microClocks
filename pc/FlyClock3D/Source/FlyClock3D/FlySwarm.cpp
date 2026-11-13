#include "FlySwarm.h"

namespace
{
	// Ziffernraster, Index 10 ist der Doppelpunkt. 3×5 wie in sim/glyphs.js; die größeren Raster
	// geben den großen 3D-Fliegen mehr Zellen pro Ziffer. Breite je Zeichen = Länge der Zeilen.
	struct FDigitFont
	{
		int32 Rows;
		const TCHAR* Glyphs[11][7];
	};
	const FDigitFont Fonts[] = {
		{ 5, {
			{ TEXT("111"), TEXT("101"), TEXT("101"), TEXT("101"), TEXT("111") },
			{ TEXT("010"), TEXT("110"), TEXT("010"), TEXT("010"), TEXT("111") },
			{ TEXT("111"), TEXT("001"), TEXT("111"), TEXT("100"), TEXT("111") },
			{ TEXT("111"), TEXT("001"), TEXT("111"), TEXT("001"), TEXT("111") },
			{ TEXT("101"), TEXT("101"), TEXT("111"), TEXT("001"), TEXT("001") },
			{ TEXT("111"), TEXT("100"), TEXT("111"), TEXT("001"), TEXT("111") },
			{ TEXT("111"), TEXT("100"), TEXT("111"), TEXT("101"), TEXT("111") },
			{ TEXT("111"), TEXT("001"), TEXT("010"), TEXT("010"), TEXT("010") },
			{ TEXT("111"), TEXT("101"), TEXT("111"), TEXT("101"), TEXT("111") },
			{ TEXT("111"), TEXT("101"), TEXT("111"), TEXT("001"), TEXT("111") },
			{ TEXT("010"), TEXT("010"), TEXT("000"), TEXT("010"), TEXT("010") }
		} },
		{ 7, {
			{ TEXT("0110"), TEXT("1001"), TEXT("1001"), TEXT("1001"), TEXT("1001"), TEXT("1001"), TEXT("0110") },
			{ TEXT("0010"), TEXT("0110"), TEXT("0010"), TEXT("0010"), TEXT("0010"), TEXT("0010"), TEXT("0111") },
			{ TEXT("0110"), TEXT("1001"), TEXT("0001"), TEXT("0010"), TEXT("0100"), TEXT("1000"), TEXT("1111") },
			{ TEXT("1110"), TEXT("0001"), TEXT("0001"), TEXT("0110"), TEXT("0001"), TEXT("0001"), TEXT("1110") },
			{ TEXT("0010"), TEXT("0110"), TEXT("1010"), TEXT("1010"), TEXT("1111"), TEXT("0010"), TEXT("0010") },
			{ TEXT("1111"), TEXT("1000"), TEXT("1110"), TEXT("0001"), TEXT("0001"), TEXT("1001"), TEXT("0110") },
			{ TEXT("0110"), TEXT("1000"), TEXT("1000"), TEXT("1110"), TEXT("1001"), TEXT("1001"), TEXT("0110") },
			{ TEXT("1111"), TEXT("0001"), TEXT("0010"), TEXT("0010"), TEXT("0100"), TEXT("0100"), TEXT("0100") },
			{ TEXT("0110"), TEXT("1001"), TEXT("1001"), TEXT("0110"), TEXT("1001"), TEXT("1001"), TEXT("0110") },
			{ TEXT("0110"), TEXT("1001"), TEXT("1001"), TEXT("0111"), TEXT("0001"), TEXT("0001"), TEXT("0110") },
			{ TEXT("0"), TEXT("1"), TEXT("1"), TEXT("0"), TEXT("1"), TEXT("1"), TEXT("0") }
		} },
		{ 7, {
			{ TEXT("01110"), TEXT("10001"), TEXT("10001"), TEXT("10001"), TEXT("10001"), TEXT("10001"), TEXT("01110") },
			{ TEXT("00100"), TEXT("01100"), TEXT("00100"), TEXT("00100"), TEXT("00100"), TEXT("00100"), TEXT("01110") },
			{ TEXT("01110"), TEXT("10001"), TEXT("00001"), TEXT("00010"), TEXT("00100"), TEXT("01000"), TEXT("11111") },
			{ TEXT("11111"), TEXT("00010"), TEXT("00100"), TEXT("00010"), TEXT("00001"), TEXT("10001"), TEXT("01110") },
			{ TEXT("00010"), TEXT("00110"), TEXT("01010"), TEXT("10010"), TEXT("11111"), TEXT("00010"), TEXT("00010") },
			{ TEXT("11111"), TEXT("10000"), TEXT("11110"), TEXT("00001"), TEXT("00001"), TEXT("10001"), TEXT("01110") },
			{ TEXT("00110"), TEXT("01000"), TEXT("10000"), TEXT("11110"), TEXT("10001"), TEXT("10001"), TEXT("01110") },
			{ TEXT("11111"), TEXT("00001"), TEXT("00010"), TEXT("00100"), TEXT("01000"), TEXT("01000"), TEXT("01000") },
			{ TEXT("01110"), TEXT("10001"), TEXT("10001"), TEXT("01110"), TEXT("10001"), TEXT("10001"), TEXT("01110") },
			{ TEXT("01110"), TEXT("10001"), TEXT("10001"), TEXT("01111"), TEXT("00001"), TEXT("00010"), TEXT("01100") },
			{ TEXT("0"), TEXT("1"), TEXT("1"), TEXT("0"), TEXT("1"), TEXT("1"), TEXT("0") }
		} }
	};

	constexpr double Pitch = 18.0;
	constexpr double Gap = 12.0;
	constexpr double ScareRadius = 76.0;
	// Im Flug sind Wege und Tempo größer als im 2D-Simulator, Laufen bleibt gleich.
	// Eine Einheit entspricht 0,45 mm, Flughöhen von 120 bis 340 also 5 bis 15 cm.
	constexpr double Air = 2.5;
	constexpr double SortieChance = 0.03;

	double Rand()
	{
		return FMath::FRand();
	}

	double WrapAngle(double Turn)
	{
		while (Turn > PI) Turn -= 2.0 * PI;
		while (Turn < -PI) Turn += 2.0 * PI;
		return Turn;
	}

	FVector2D Beside(const FVector2D& Point, double Min, double Max)
	{
		const double Angle = Rand() * 2.0 * PI;
		const double Dist = Min + Rand() * (Max - Min);
		return Point + FVector2D(FMath::Cos(Angle), FMath::Sin(Angle)) * Dist;
	}

	FVector2D ClampLoose(const FVector2D& Point)
	{
		constexpr double Margin = -24.0 * Air;
		return FVector2D(
			FMath::Clamp(Point.X, Margin, FlyPanel::W - Margin),
			FMath::Clamp(Point.Y, Margin, FlyPanel::H - Margin));
	}

	FVector2D OutsidePoint()
	{
		const double Margin = 150.0 + Rand() * 350.0;
		const double Along = Rand();
		switch (FMath::RandRange(0, 3))
		{
		case 0: return FVector2D(Along * FlyPanel::W, -Margin);
		case 1: return FVector2D(FlyPanel::W + Margin, Along * FlyPanel::H);
		case 2: return FVector2D(Along * FlyPanel::W, FlyPanel::H + Margin);
		default: return FVector2D(-Margin, Along * FlyPanel::H);
		}
	}

	// Kurze Sprünge mit Knicken. Der letzte liegt auf dem Ziel.
	TArray<FVector2D> HopPath(const FVector2D& From, const FVector2D& Toward, double Chaos, int32 MinSteps)
	{
		TArray<FVector2D> Points;
		FVector2D At = From;
		double Heading = FMath::Atan2(Toward.Y - At.Y, Toward.X - At.X);
		const double Dist = FVector2D::Distance(Toward, From);
		const int32 Steps = FMath::Max(MinSteps, FMath::Min(8, FMath::CeilToInt(Dist / (30.0 * Air))));
		for (int32 i = 0; i < Steps; i++)
		{
			const FVector2D Rest = Toward - At;
			const double Len = Rest.Size();
			if (Len < 16.0 * Air)
			{
				Points.Add(Toward);
				break;
			}
			const double Aim = FMath::Atan2(Rest.Y, Rest.X);
			Heading += WrapAngle(Aim - Heading) * (0.5 + (1.0 - Chaos) * 0.35);
			Heading += (Rand() - 0.5) * Chaos * 1.5;
			const double Step = FMath::Min((16.0 + Rand() * 12.0) * Air, Len);
			At += FVector2D(FMath::Cos(Heading), FMath::Sin(Heading)) * Step;
			Points.Add(ClampLoose(At));
		}
		return Points;
	}

	// Flucht: mehrere kurze Knicke nach außen, kein ferner Zielpunkt.
	TArray<FVector2D> FleePath(const FVector2D& From, double Angle)
	{
		TArray<FVector2D> Points;
		FVector2D At = From;
		double Heading = Angle;
		const int32 Steps = 5 + FMath::RandRange(0, 1);
		for (int32 i = 0; i < Steps; i++)
		{
			Heading += (Rand() - 0.5) * 2.2;
			Heading += WrapAngle(Angle - Heading) * 0.22;
			const double Step = (14.0 + Rand() * 10.0) * Air;
			At += FVector2D(FMath::Cos(Heading), FMath::Sin(Heading)) * Step;
			Points.Add(ClampLoose(At));
		}
		return Points;
	}

	// Echte Fliegen halten die Höhe nicht, sie sacken und steigen im Flug ständig ein wenig.
	void Climb(FFly& Fly, double Target)
	{
		if (Target > 40.0)
		{
			Target += FMath::Sin(Fly.Phase * 0.55 + Fly.Nerve * 6.0) * 28.0 + FMath::Sin(Fly.Anim * 0.21) * 12.0;
		}
		Fly.VZ += (Target - Fly.Z) * 0.05;
		Fly.VZ *= 0.82;
		Fly.Z += Fly.VZ;
		if (Fly.Z < 0.0)
		{
			Fly.Z = 0.0;
			Fly.VZ = 0.0;
		}
	}

	// Kurs folgt der Geschwindigkeit, in der Luft mit Schräglage in die Kurve.
	void Face(FFly& Fly, double Rate, bool bAir)
	{
		if (Fly.V.Size() > 0.05)
		{
			Fly.TargetYaw = FMath::Atan2(Fly.V.Y, Fly.V.X);
		}
		const double Delta = WrapAngle(Fly.TargetYaw - Fly.Yaw);
		Fly.Yaw = WrapAngle(Fly.Yaw + Delta * Rate);
		const double Bank = bAir ? FMath::Clamp(Delta * 1.6, -0.7, 0.7) : 0.0;
		Fly.Bank += (Bank - Fly.Bank) * 0.2;
	}

	void TurnInPlace(FFly& Fly, double Rate)
	{
		const double Turn = WrapAngle(Fly.TargetYaw - Fly.Yaw) * Rate;
		Fly.Yaw = WrapAngle(Fly.Yaw + Turn);
		Fly.Bank *= 0.8;
		// Auf der Stelle drehen heißt trippeln, sonst schleifen die Beine über den Boden.
		if (FMath::Abs(Turn) > 0.003)
		{
			Fly.Anim += 0.3;
			Fly.bStepping = true;
		}
	}

	int32 GlyphWidth(const FDigitFont& Font, int32 Char)
	{
		return FCString::Strlen(Font.Glyphs[Char][0]);
	}

	void SlotsFor(const FDigitFont& Font, const TArray<int32>& Chars, double X, double Y, double CellPitch, double CellGap, TCHAR Prefix, TArray<FFlySlot>& Out)
	{
		double Cursor = X;
		for (int32 i = 0; i < Chars.Num(); i++)
		{
			const TCHAR* const* Rows = Font.Glyphs[Chars[i]];
			const int32 Cols = GlyphWidth(Font, Chars[i]);
			for (int32 Row = 0; Row < Font.Rows; Row++)
			{
				for (int32 Col = 0; Col < Cols; Col++)
				{
					if (Rows[Row][Col] != TEXT('1')) continue;
					FFlySlot Slot;
					Slot.Id = FString::Printf(TEXT("%c%d:%d:%d"), Prefix, i, Row, Col);
					Slot.P = FVector2D(Cursor + Col * CellPitch + CellPitch / 2.0, Y + Row * CellPitch + CellPitch / 2.0);
					Out.Add(Slot);
				}
			}
			Cursor += Cols * CellPitch + CellGap;
		}
	}
}

int32 DigitSizeCount()
{
	return UE_ARRAY_COUNT(Fonts);
}

const TCHAR* DigitSizeName(int32 Size)
{
	static const TCHAR* const Names[] = { TEXT("3x5"), TEXT("4x7"), TEXT("5x7") };
	return Names[FMath::Clamp(Size, 0, DigitSizeCount() - 1)];
}

TArray<FFlySlot> MakeClockSlots(int32 Hours, int32 Minutes, int32 Size)
{
	const FDigitFont& Font = Fonts[FMath::Clamp(Size, 0, DigitSizeCount() - 1)];
	const TArray<int32> Chars = { Hours / 10, Hours % 10, 10, Minutes / 10, Minutes % 10 };
	double Width = (Chars.Num() - 1) * Gap;
	for (int32 Char : Chars) Width += GlyphWidth(Font, Char) * Pitch;
	const double Height = Font.Rows * Pitch;
	TArray<FFlySlot> Slots;
	SlotsFor(Font, Chars, (FlyPanel::W - Width) / 2.0, (FlyPanel::H - Height) / 2.0 - 8.0, Pitch, Gap, TEXT('t'), Slots);
	return Slots;
}

TArray<FFlySlot> MakeStackedSlots(int32 Hours, int32 Minutes)
{
	// Wie stackedSlots in sim/glyphs.js: Stunden oben, Minuten darunter.
	constexpr double StackPitch = 36.0;
	constexpr double StackGap = 16.0;
	constexpr double StackRow = 22.0;
	const double Width = 6.0 * StackPitch + StackGap;
	const double RowHeight = 5.0 * StackPitch;
	const double X = (FlyPanel::W - Width) / 2.0;
	const double Y = (FlyPanel::H - (2.0 * RowHeight + StackRow)) / 2.0;
	TArray<FFlySlot> Slots;
	SlotsFor(Fonts[0], { Hours / 10, Hours % 10 }, X, Y, StackPitch, StackGap, TEXT('h'), Slots);
	SlotsFor(Fonts[0], { Minutes / 10, Minutes % 10 }, X, Y + RowHeight + StackRow, StackPitch, StackGap, TEXT('m'), Slots);
	return Slots;
}

void FFlySwarm::Init(int32 Pool, int32 Rovers)
{
	Flies.SetNum(Pool + Rovers);
	for (int32 i = 0; i < Flies.Num(); i++)
	{
		FFly& Fly = Flies[i];
		Fly.Nerve = Rand();
		Fly.Phase = Rand() * 2.0 * PI;
		if (i < Pool) continue;
		Fly.bRover = true;
		Fly.bActive = true;
		Fly.P = OutsidePoint();
		Fly.Mode = EFlyMode::Fly;
		Fly.Cruise = 200.0;
		Fly.Z = 300.0;
	}
	Stamp.Reset();
}

int32 FFlySwarm::Update(const FVector2D* Finger, int32 Hours, int32 Minutes)
{
	const FString Key = FString::Printf(TEXT("%d:%d"), Hours, Minutes);
	if (Key != Stamp)
	{
		Stamp = Key;
		Sync(MakeClockSlots(Hours, Minutes, Size));
	}

	int32 Flying = 0;
	for (FFly& Fly : Flies)
	{
		if (!Fly.bActive) continue;
		Fly.bStepping = false;
		if (Fly.bRover)
		{
			StepRover(Fly);
			continue;
		}
		// Neue Fliegen warten außerhalb des Bildes, damit sie nicht alle gleichzeitig eintreffen.
		if (Fly.Rest > 0)
		{
			Fly.Rest--;
			continue;
		}
		if (Fly.bHasExit)
		{
			StepExit(Fly);
		}
		else
		{
			if (Finger) Scare(Fly, *Finger);
			if (Fly.Mode == EFlyMode::Idle) StepIdle(Fly);
			else StepMove(Fly);
		}
		if (Fly.bActive && (Fly.Mode == EFlyMode::Fly || (Finger && Fly.bAlarmed))) Flying++;
	}
	return Flying;
}

void FFlySwarm::Sync(const TArray<FFlySlot>& Slots)
{
	TMap<FString, FVector2D> ById;
	for (const FFlySlot& Slot : Slots) ById.Add(Slot.Id, Slot.P);
	TSet<FString> Taken;
	for (FFly& Fly : Flies)
	{
		if (!Fly.bActive || Fly.SlotId.IsEmpty()) continue;
		const FVector2D* Found = ById.Find(Fly.SlotId);
		if (!Found)
		{
			StartExit(Fly);
			continue;
		}
		Taken.Add(Fly.SlotId);
		Fly.Goal = *Found;
		Fly.bHasGoal = true;
		if (Fly.Mode == EFlyMode::Idle && Fly.bHasIdle && Fly.Idle.Kind == EIdleKind::Pace)
		{
			Fly.Idle.Origin = *Found;
		}
	}
	for (const FFlySlot& Slot : Slots)
	{
		if (Taken.Contains(Slot.Id)) continue;
		FFly* Free = Flies.FindByPredicate([](const FFly& Item) { return !Item.bActive; });
		if (Free) Spawn(*Free, Slot);
	}
}

void FFlySwarm::Spawn(FFly& Fly, const FFlySlot& Slot)
{
	const FVector2D Start = OutsidePoint();
	Fly.bActive = true;
	Fly.P = Start;
	Fly.V = FVector2D::ZeroVector;
	Fly.SlotId = Slot.Id;
	Fly.Goal = Slot.P;
	Fly.bHasGoal = true;
	Fly.bHasExit = false;
	Fly.bHasIdle = false;
	Fly.bLeaving = false;
	Fly.bAlarmed = false;
	Fly.Hesitate = 0;
	Fly.bHasLand = false;
	Fly.Route = HopPath(Start, Slot.P, 0.45, 2);
	Fly.Hop = 0;
	Fly.Mode = EFlyMode::Fly;
	Fly.Cruise = 120.0 + Rand() * 220.0;
	Fly.Z = Fly.Cruise + 150.0 + Rand() * 300.0;
	Fly.VZ = 0.0;
	Fly.Yaw = FMath::Atan2(Slot.P.Y - Start.Y, Slot.P.X - Start.X);
	Fly.TargetYaw = Fly.Yaw;
	Fly.Bank = 0.0;
	Fly.Anim = Rand() * 8.0;
	Fly.Proboscis = 0.0;
	Fly.Rest = FMath::RoundToInt(Rand() * Rand() * 300.0);
}

void FFlySwarm::StartExit(FFly& Fly)
{
	if (Fly.Mode != EFlyMode::Fly) Fly.VZ += 3.0;
	Fly.SlotId.Reset();
	Fly.bHasGoal = false;
	Fly.bHasLand = false;
	Fly.bHasIdle = false;
	Fly.Route.Reset();
	Fly.bLeaving = false;
	Fly.bAlarmed = false;
	Fly.Hesitate = 0;
	Fly.bHasExit = true;
	Fly.Exit = OutsidePoint();
	Fly.Mode = EFlyMode::Fly;
	Fly.Proboscis = 0.0;
}

void FFlySwarm::Scare(FFly& Fly, const FVector2D& Finger)
{
	const FVector2D Away = Fly.P - Finger;
	const double Dist = Away.Size();
	if (Dist > ScareRadius)
	{
		Fly.bAlarmed = false;
		Fly.Hesitate = 0;
		return;
	}
	if (Fly.bLeaving) return;
	if (!Fly.bAlarmed)
	{
		const double Closeness = 1.0 - Dist / ScareRadius;
		Fly.bAlarmed = true;
		Fly.Hesitate = FMath::RoundToInt((1.0 - Closeness) * (6.0 + Fly.Nerve * 26.0) + Fly.Nerve * 32.0);
	}
	if (Fly.Hesitate > 0)
	{
		Fly.Hesitate--;
		return;
	}
	Fly.bAlarmed = false;
	const double Angle = Dist < 1.0
		? Rand() * 2.0 * PI
		: FMath::Atan2(Away.Y, Away.X) + (Rand() - 0.5) * 0.9;
	Fly.bLeaving = true;
	Fly.bHasLand = false;
	Fly.Route = FleePath(Fly.P, Angle);
	Fly.Hop = 0;
	Fly.bHasIdle = false;
	Fly.Proboscis = 0.0;
	if (Fly.Mode != EFlyMode::Fly) Fly.VZ += 4.5;
	Fly.Mode = EFlyMode::Fly;
}

void FFlySwarm::StepMove(FFly& Fly)
{
	if (Fly.Route.Num() > 0)
	{
		const FVector2D Point = Fly.Route[0];
		const FVector2D Delta = Point - Fly.P;
		const double RouteDist = FMath::Max(Delta.Size(), 0.0001);
		Fly.Hop++;
		if (RouteDist < 10.0 * Air || Fly.Hop > 40)
		{
			Fly.Hop = 0;
			Fly.Route.RemoveAt(0);
			if (Fly.Route.Num() > 0) return;
			if (Fly.bLeaving && Fly.bHasGoal)
			{
				Fly.bLeaving = false;
				Fly.Route = HopPath(Fly.P, Fly.Goal, 0.45, 2);
				return;
			}
			Fly.bLeaving = false;
			if (Fly.bHasGoal)
			{
				// Weit genug neben der Zelle, dass der Fußweg dorthin gut eine Sekunde dauert.
				Fly.Land = Beside(Fly.Goal, 16.0, 30.0);
				Fly.bHasLand = true;
				Fly.Mode = EFlyMode::Fly;
			}
		}
		else
		{
			SteerFly(Fly, Delta, RouteDist, FMath::Min(1.15 * Air, 0.35 * Air + RouteDist * 0.05));
			Climb(Fly, Fly.bLeaving ? Fly.Cruise * 1.3 : Fly.Cruise);
			return;
		}
	}

	if (!Fly.bHasGoal) return;
	FVector2D Steer = Fly.Goal;
	double LandDist = 0.0;
	if (Fly.Mode != EFlyMode::Walk && Fly.bHasLand)
	{
		LandDist = FVector2D::Distance(Fly.Land, Fly.P);
		if (LandDist < 26.0) Fly.Mode = EFlyMode::Walk;
		else Steer = Fly.Land;
	}
	const FVector2D Delta = Steer - Fly.P;
	const double Dist = FMath::Max(Delta.Size(), 0.0001);
	const bool bWalking = Fly.Mode == EFlyMode::Walk;
	const bool bTouchdown = bWalking && Fly.Z > 0.5;
	const double Cruise = (Dist > 90.0 ? 2.6 : 2.1) * Air;
	// Zu Fuß etwa eine Körperlänge pro Sekunde, damit das Krabbeln zu sehen ist.
	double Speed = bWalking ? 0.32 : FMath::Min(Cruise, 0.4 + Dist * 0.07);
	if (bTouchdown) Speed = 0.5;
	const double Gain = Dist < 36.0 ? 0.5 : 0.2;
	Fly.V += ((Delta / Dist) * Speed - Fly.V) * (bWalking ? 0.35 : Gain);
	if (!bWalking && Dist > 80.0 * Air)
	{
		Fly.Phase += 0.2;
		const double Wobble = FMath::Sin(Fly.Phase) * 0.16;
		Fly.V += FVector2D(-Delta.Y / Dist, Delta.X / Dist) * Wobble;
	}
	if (bWalking && Dist < 12.0) Fly.V *= 0.72;
	Fly.P += Fly.V;
	Separate(Fly);
	Fly.Anim += bWalking ? 0.32 : 0.55;
	if (bWalking)
	{
		Fly.Z = FMath::Max(0.0, Fly.Z - FMath::Max(0.5, Fly.Z * 0.15));
		Fly.VZ = 0.0;
		Fly.bStepping = !bTouchdown;
	}
	else
	{
		const double Ahead = Fly.bHasLand ? LandDist - 26.0 : Dist - 20.0;
		Climb(Fly, Fly.Cruise * FMath::Clamp(Ahead / (70.0 * Air), 0.0, 1.0));
	}
	Face(Fly, bWalking ? 0.22 : 0.3, !bWalking);

	if (bWalking && !bTouchdown && FVector2D::Distance(Fly.Goal, Fly.P) < 2.0) Settle(Fly);
}

void FFlySwarm::SteerFly(FFly& Fly, const FVector2D& Delta, double Dist, double Speed)
{
	const double Gain = Dist < 36.0 * Air ? 0.5 : 0.22;
	Fly.V += ((Delta / Dist) * Speed - Fly.V) * Gain;
	if (Dist > 70.0 * Air)
	{
		Fly.Phase += 0.16;
		const double Wobble = FMath::Sin(Fly.Phase) * 0.08;
		Fly.V += FVector2D(-Delta.Y / Dist, Delta.X / Dist) * Wobble;
	}
	Fly.P += Fly.V;
	if (Dist > 30.0) Separate(Fly);
	Fly.Anim += 0.42;
	Fly.Mode = EFlyMode::Fly;
	Face(Fly, 0.3, true);
}

void FFlySwarm::Settle(FFly& Fly)
{
	Fly.P = Fly.Goal;
	Fly.V = FVector2D::ZeroVector;
	Fly.Z = 0.0;
	Fly.VZ = 0.0;
	Fly.bHasLand = false;
	Fly.Route.Reset();
	Fly.bLeaving = false;
	Fly.Mode = EFlyMode::Idle;
	BeginIdle(Fly);
}

void FFlySwarm::BeginIdle(FFly& Fly)
{
	if (!Fly.bRover && Fly.bHasGoal && Rand() < SortieChance)
	{
		Sortie(Fly);
		return;
	}
	FFlyIdle& Idle = Fly.Idle;
	Idle = FFlyIdle();
	Fly.bHasIdle = true;
	Fly.Proboscis = 0.0;
	const double Roll = Rand();
	if (Roll < 0.4)
	{
		Idle.Kind = EIdleKind::Stand;
		Idle.Left = 140 + FMath::RoundToInt(Rand() * 220.0);
	}
	else if (Roll < 0.6)
	{
		Idle.Kind = EIdleKind::Proboscis;
		Idle.Left = 80 + FMath::RoundToInt(Rand() * 100.0);
	}
	else if (Roll < 0.78)
	{
		Idle.Kind = EIdleKind::Turn;
		Idle.Left = 36 + FMath::RoundToInt(Rand() * 30.0);
		Idle.Steps = 1 + (Rand() < 0.5 ? 1 : 0);
		Idle.DirStep = Rand() < 0.5 ? -1 : 1;
		Idle.Pause = 16;
	}
	else
	{
		Idle.Kind = EIdleKind::Pace;
		Idle.Left = 30 + FMath::RoundToInt(Rand() * 30.0);
		Idle.bOut = true;
		Idle.HomeYaw = Fly.Yaw;
		Idle.Origin = Fly.Goal;
	}
}

void FFlySwarm::StepIdle(FFly& Fly)
{
	if (!Fly.bHasIdle)
	{
		BeginIdle(Fly);
		return;
	}
	FFlyIdle& Idle = Fly.Idle;
	Fly.V = FVector2D::ZeroVector;
	Fly.Z = 0.0;
	switch (Idle.Kind)
	{
	case EIdleKind::Stand:
		Fly.P = Fly.Goal;
		TurnInPlace(Fly, 0.12);
		if (--Idle.Left <= 0) BeginIdle(Fly);
		return;
	case EIdleKind::Proboscis:
		Idle.Tick++;
		Fly.Proboscis = (Idle.Tick / 9) % 2 == 0 ? 0.0 : 1.0;
		Fly.P = Fly.Goal;
		TurnInPlace(Fly, 0.12);
		if (--Idle.Left <= 0) BeginIdle(Fly);
		return;
	case EIdleKind::Turn:
		Fly.P = Fly.Goal;
		if (--Idle.Pause <= 0 && Idle.Steps > 0)
		{
			Fly.TargetYaw = WrapAngle(Fly.TargetYaw + Idle.DirStep * PI / 4.0);
			Idle.Steps--;
			Idle.Pause = 18;
		}
		TurnInPlace(Fly, 0.12);
		if (--Idle.Left <= 0) BeginIdle(Fly);
		return;
	case EIdleKind::Pace:
	default:
		break;
	}

	constexpr double Step = 0.3;
	const bool bAligned = FMath::Abs(WrapAngle(Fly.TargetYaw - Fly.Yaw)) < 0.3;
	if (Idle.bOut)
	{
		if (bAligned)
		{
			Fly.P += FVector2D(FMath::Cos(Fly.Yaw), FMath::Sin(Fly.Yaw)) * Step;
			Fly.Anim += 0.3;
			Fly.bStepping = true;
			if (--Idle.Left <= 0)
			{
				Idle.bOut = false;
				Fly.TargetYaw = WrapAngle(Fly.Yaw + PI);
			}
		}
	}
	else
	{
		const FVector2D Back = Idle.Origin - Fly.P;
		const double Len = Back.Size();
		if (Len < 0.6)
		{
			Fly.P = Idle.Origin;
			Fly.TargetYaw = Idle.HomeYaw;
			BeginIdle(Fly);
			return;
		}
		Fly.TargetYaw = FMath::Atan2(Back.Y, Back.X);
		if (bAligned)
		{
			Fly.P += Back / Len * FMath::Min(Step, Len);
			Fly.Anim += 0.3;
			Fly.bStepping = true;
		}
	}
	TurnInPlace(Fly, 0.15);
}

void FFlySwarm::StepExit(FFly& Fly)
{
	const FVector2D Delta = Fly.Exit - Fly.P;
	const double Dist = FMath::Max(Delta.Size(), 0.0001);
	Fly.V += ((Delta / Dist) * 3.5 * Air - Fly.V) * 0.16;
	Fly.Phase += 0.2;
	const double Wobble = FMath::Sin(Fly.Phase) * 0.15;
	Fly.V += FVector2D(-Delta.Y / Dist, Delta.X / Dist) * Wobble;
	Fly.P += Fly.V;
	Fly.Anim += 0.55;
	Fly.Mode = EFlyMode::Fly;
	Climb(Fly, Fly.Cruise + 300.0);
	Face(Fly, 0.3, true);
	if (Dist < 16.0 * Air)
	{
		Fly.bActive = false;
		Fly.bHasExit = false;
		Fly.Mode = EFlyMode::Off;
		Fly.V = FVector2D::ZeroVector;
	}
}

// Kurzer Ausflug ohne Anlass: abheben, ein paar Haken schlagen, zur eigenen Stelle zurück.
void FFlySwarm::Sortie(FFly& Fly)
{
	Fly.bHasIdle = false;
	Fly.bLeaving = true;
	Fly.bHasLand = false;
	Fly.Route = FleePath(Fly.P, Rand() * 2.0 * PI);
	Fly.Hop = 0;
	Fly.Proboscis = 0.0;
	Fly.Cruise = 120.0 + Rand() * 220.0;
	Fly.VZ += 4.5;
	Fly.Mode = EFlyMode::Fly;
}

void FFlySwarm::TakeOff(FFly& Fly)
{
	Fly.bHasGoal = false;
	Fly.bHasLand = false;
	Fly.bHasIdle = false;
	Fly.Route.Reset();
	Fly.Proboscis = 0.0;
	Fly.VZ += 4.5;
	Fly.Mode = EFlyMode::Fly;
}

void FFlySwarm::StepRover(FFly& Fly)
{
	if (Fly.Mode == EFlyMode::Idle)
	{
		if (Fly.Rest <= 0) Fly.Rest = 240 + FMath::RoundToInt(Rand() * 600.0);
		StepIdle(Fly);
		if (--Fly.Rest <= 0) TakeOff(Fly);
		return;
	}
	if (Fly.bHasGoal)
	{
		StepMove(Fly);
		return;
	}
	if (Fly.Route.Num() == 0)
	{
		if (Rand() < 0.3)
		{
			// Landen irgendwo im Bild, auch zwischen den Ziffern.
			Fly.Goal = FVector2D(30.0 + Rand() * (FlyPanel::W - 60.0), 20.0 + Rand() * (FlyPanel::H - 60.0));
			Fly.bHasGoal = true;
			Fly.bLeaving = false;
			Fly.Route = HopPath(Fly.P, Fly.Goal, 0.6, 2);
			Fly.Hop = 0;
			Fly.Cruise = 120.0 + Rand() * 200.0;
			return;
		}
		// Weit ausholen, auch über den Bildrand hinaus und hoch über die Kamera.
		Fly.Route.Add(FVector2D(-250.0 + Rand() * (FlyPanel::W + 500.0), -900.0 + Rand() * (FlyPanel::H + 1000.0)));
		Fly.Cruise = 100.0 + Rand() * 600.0;
		Fly.Hop = 0;
	}
	const FVector2D Delta = Fly.Route[0] - Fly.P;
	const double Dist = FMath::Max(Delta.Size(), 0.0001);
	if (Dist < 20.0 * Air)
	{
		Fly.Route.RemoveAt(0);
		return;
	}
	SteerFly(Fly, Delta, Dist, FMath::Min(1.4 * Air, 0.35 * Air + Dist * 0.05));
	Climb(Fly, Fly.Cruise);
}

void FFlySwarm::Separate(FFly& Fly)
{
	if (Fly.bHasGoal && FVector2D::Distance(Fly.Goal, Fly.P) < 10.0) return;
	for (const FFly& Other : Flies)
	{
		if (!Other.bActive || &Other == &Fly || Other.Mode == EFlyMode::Idle) continue;
		if (FMath::Abs(Other.Z - Fly.Z) > 8.0) continue;
		const FVector2D Away = Fly.P - Other.P;
		const double Dist = Away.Size();
		if (Dist >= 12.0 || Dist < 0.001) continue;
		Fly.P += Away / Dist * ((12.0 - Dist) * 0.08);
	}
}
