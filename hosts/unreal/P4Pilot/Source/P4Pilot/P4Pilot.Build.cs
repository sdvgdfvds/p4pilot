using UnrealBuildTool;

public class P4Pilot : ModuleRules
{
    public P4Pilot(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PrivateDependencyModuleNames.AddRange(new[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "LevelEditor",
            "Slate",
            "SlateCore",
            "ToolMenus",
            "WebBrowser",
            "WebBrowserWidget"
        });
    }
}
