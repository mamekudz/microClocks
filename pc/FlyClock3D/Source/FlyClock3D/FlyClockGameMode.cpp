#include "FlyClockGameMode.h"

#include "Engine/World.h"
#include "FlyClock.h"
#include "GameFramework/Pawn.h"

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
}

void AFlyClockGameMode::StartPlay()
{
	Super::StartPlay();
	GetWorld()->SpawnActor<AFlyClock>(FVector::ZeroVector, FRotator::ZeroRotator);
}
