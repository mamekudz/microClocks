#include "FlyClockGameMode.h"

#include "Engine/World.h"
#include "EngineUtils.h"
#include "FlyClock.h"
#include "GameFramework/Pawn.h"

void AFlyClockHUD::DrawHUD()
{
	Super::DrawHUD();
	if (!Clock.IsValid())
	{
		TActorIterator<AFlyClock> It(GetWorld());
		if (It) Clock = *It;
	}
	if (Clock.IsValid()) Clock->DrawOverlay(Canvas);
}

AFlyClockController::AFlyClockController()
{
	bShowMouseCursor = true;
	DefaultMouseCursor = EMouseCursor::Crosshairs;
}

void AFlyClockController::BeginPlay()
{
	Super::BeginPlay();
	FInputModeGameAndUI Mode;
	Mode.SetHideCursorDuringCapture(false);
	Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
	SetInputMode(Mode);
}

AFlyClockGameMode::AFlyClockGameMode()
{
	PlayerControllerClass = AFlyClockController::StaticClass();
	DefaultPawnClass = APawn::StaticClass();
	HUDClass = AFlyClockHUD::StaticClass();
}

void AFlyClockGameMode::StartPlay()
{
	Super::StartPlay();
	GetWorld()->SpawnActor<AFlyClock>(FVector::ZeroVector, FRotator::ZeroRotator);
}
