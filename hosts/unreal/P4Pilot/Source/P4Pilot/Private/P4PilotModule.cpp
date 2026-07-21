#include "P4PilotModule.h"

#include "Framework/Docking/TabManager.h"
#include "HAL/PlatformMisc.h"
#include "LevelEditor.h"
#include "SWebBrowser.h"
#include "ToolMenus.h"
#include "Widgets/Docking/SDockTab.h"

namespace
{
const FName P4PilotTabName(TEXT("P4Pilot"));

FString GetP4PilotUrl()
{
    FString Url = FPlatformMisc::GetEnvironmentVariable(TEXT("P4PILOT_HOST_URL"));
    if (Url.IsEmpty())
    {
        Url = TEXT("http://127.0.0.1:4715/p4pilot/?backend=local");
    }
    return Url;
}
}

void FP4PilotModule::StartupModule()
{
    FGlobalTabmanager::Get()->RegisterNomadTabSpawner(
        P4PilotTabName,
        FOnSpawnTab::CreateRaw(this, &FP4PilotModule::SpawnP4PilotTab))
        .SetDisplayName(FText::FromString(TEXT("p4pilot")))
        .SetMenuType(ETabSpawnerMenuType::Hidden);

    UToolMenus::RegisterStartupCallback(
        FSimpleMulticastDelegate::FDelegate::CreateRaw(this, &FP4PilotModule::RegisterMenus));
}

void FP4PilotModule::ShutdownModule()
{
    UToolMenus::UnRegisterStartupCallback(this);
    UToolMenus::UnregisterOwner(this);
    FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(P4PilotTabName);
}

TSharedRef<SDockTab> FP4PilotModule::SpawnP4PilotTab(const FSpawnTabArgs& Args)
{
    return SNew(SDockTab)
        .TabRole(ETabRole::NomadTab)
        [
            SNew(SWebBrowser)
                .InitialURL(GetP4PilotUrl())
                .ShowControls(false)
                .SupportsTransparency(false)
        ];
}

void FP4PilotModule::RegisterMenus()
{
    FToolMenuOwnerScoped OwnerScoped(this);
    UToolMenu* Menu = UToolMenus::Get()->ExtendMenu(TEXT("LevelEditor.MainMenu.Window"));
    FToolMenuSection& Section = Menu->FindOrAddSection(TEXT("WindowLayout"));
    Section.AddMenuEntry(
        TEXT("OpenP4Pilot"),
        FText::FromString(TEXT("p4pilot")),
        FText::FromString(TEXT("Open the p4pilot Perforce workspace")),
        FSlateIcon(),
        FUIAction(FExecuteAction::CreateLambda([]
        {
            FGlobalTabmanager::Get()->TryInvokeTab(P4PilotTabName);
        })));
}

IMPLEMENT_MODULE(FP4PilotModule, P4Pilot)
