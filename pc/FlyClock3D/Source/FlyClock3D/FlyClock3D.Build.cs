using UnrealBuildTool;

public class FlyClock3D : ModuleRules
{
	public FlyClock3D(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "InputCore", "AssetRegistry", "CinematicCamera", "SlateCore", "Json" });
	}
}
