#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/HUD.h"
#include "GameFramework/PlayerController.h"
#include "FlyClockGameMode.generated.h"

class AFlyClock;

UCLASS()
class AFlyClockHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;

private:
	TWeakObjectPtr<AFlyClock> Clock;
};

UCLASS()
class AFlyClockController : public APlayerController
{
	GENERATED_BODY()

public:
	AFlyClockController();

	virtual void BeginPlay() override;
};

UCLASS()
class AFlyClockGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AFlyClockGameMode();

	virtual void StartPlay() override;
};
