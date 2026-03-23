use tauri_plugin_window_state::StateFlags;

pub const SETTINGS_STORE: &str = "opencode.settings.dat";
pub const DEFAULT_SERVER_URL_KEY: &str = "defaultServerUrl";
pub const WSL_ENABLED_KEY: &str = "wslEnabled";
pub const SERVER_PORT_KEY: &str = "serverPort";
pub const SERVER_PASSWORD_KEY: &str = "serverPassword";
pub const SERVER_HOSTNAME_KEY: &str = "serverHostname";
pub const SERVER_EXTERNAL_HOSTNAME_KEY: &str = "serverExternalHostname";
pub const UPDATER_ENABLED: bool = option_env!("TAURI_SIGNING_PRIVATE_KEY").is_some();

pub fn window_state_flags() -> StateFlags {
    StateFlags::all() - StateFlags::DECORATIONS - StateFlags::VISIBLE
}
