#pragma once

#include "CoreMinimal.h"

/**
 * i18x für die Knopfleiste: Quelltexte sind en-US mit <context="…"/> und Platzhaltern <name/>, Übersetzungen liegen in
 * Content/i18x/<lid>.json (Schlüssel = Quelltext samt Kontext). Die Sprache kommt aus -lang=<lid>, sonst von Windows.
 */
namespace FlyI18x
{
	void Load();
	FString Trans(const TCHAR* Source, const TMap<FString, FString>& Values = {});
}
