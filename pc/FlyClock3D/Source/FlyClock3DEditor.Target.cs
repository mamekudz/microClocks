using UnrealBuildTool;

public class FlyClock3DEditorTarget : TargetRules
{
	public FlyClock3DEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("FlyClock3D");
	}
}
