#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "FlyClockEditorLibrary.generated.h"

class UMaterial;
class UMaterialExpression;

/** Hilfen für Scripts/setup_assets.py, wo die Python-Schnittstelle sie nicht anbietet. */
UCLASS()
class UFlyClockEditorLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** Verbindet einen Knoten mit World Position Offset; EMaterialProperty führt diesen Eingang in Python nicht. */
	UFUNCTION(BlueprintCallable, Category = "FlyClock")
	static bool ConnectWorldPositionOffset(UMaterial* Material, UMaterialExpression* Expression);
};
