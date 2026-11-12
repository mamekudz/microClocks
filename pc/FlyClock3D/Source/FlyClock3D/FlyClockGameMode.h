#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/PlayerController.h"
#include "FlyClockGameMode.generated.h"

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
