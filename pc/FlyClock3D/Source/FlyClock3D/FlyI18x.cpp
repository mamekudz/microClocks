#include "FlyI18x.h"

#include "Dom/JsonObject.h"
#include "HAL/FileManager.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

namespace
{
	TMap<FString, FString> Table;

	FString StripContext(FString Text)
	{
		int32 Start = Text.Find(TEXT("<context=\""));
		while (Start != INDEX_NONE)
		{
			const int32 End = Text.Find(TEXT("/>"), ESearchCase::CaseSensitive, ESearchDir::FromStart, Start);
			if (End == INDEX_NONE) break;
			Text.RemoveAt(Start, End + 2 - Start);
			Start = Text.Find(TEXT("<context=\""));
		}
		return Text;
	}
}

void FlyI18x::Load()
{
	Table.Reset();
	FString Lid;
	if (!FParse::Value(FCommandLine::Get(), TEXT("lang="), Lid)) Lid = FPlatformMisc::GetDefaultLocale();
	if (Lid.StartsWith(TEXT("en"))) return;

	const FString Folder = FPaths::ProjectContentDir() / TEXT("i18x");
	FString File = Folder / (Lid + TEXT(".json"));
	if (!FPaths::FileExists(File))
	{
		// Nur die Sprache passt, etwa "de-AT" zu de-DE.json.
		TArray<FString> Found;
		IFileManager::Get().FindFiles(Found, *(Folder / (Lid.Left(2) + TEXT("-*.json"))), true, false);
		if (Found.Num() == 0) return;
		File = Folder / Found[0];
	}

	FString Json;
	TSharedPtr<FJsonObject> Root;
	if (!FFileHelper::LoadFileToString(Json, *File) || !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Json), Root) || !Root.IsValid())
	{
		UE_LOG(LogTemp, Warning, TEXT("FlyClock: translation not readable: %s"), *File);
		return;
	}
	for (const TPair<FString, TSharedPtr<FJsonValue>>& Entry : Root->Values)
	{
		FString Value;
		if (Entry.Value.IsValid() && Entry.Value->TryGetString(Value) && !Value.IsEmpty()) Table.Add(Entry.Key, Value);
	}
	UE_LOG(LogTemp, Display, TEXT("FlyClock: language %s, %d texts from %s"), *Lid, Table.Num(), *File);
}

FString FlyI18x::Trans(const TCHAR* Source, const TMap<FString, FString>& Values)
{
	const FString* Found = Table.Find(Source);
	FString Result = StripContext(Found ? *Found : FString(Source));
	for (const TPair<FString, FString>& Value : Values)
	{
		Result.ReplaceInline(*FString::Printf(TEXT("<%s/>"), *Value.Key), *Value.Value, ESearchCase::CaseSensitive);
	}
	return Result;
}
