using UnrealBuildTool;

public class FlyClock3DTarget : TargetRules
{
	public FlyClock3DTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("FlyClock3D");
	}
}
