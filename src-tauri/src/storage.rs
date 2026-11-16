use serde_json::Value;
use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

static UNIQUE_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn data_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve the app data directory: {error}"))?;
    Ok(dir.join("payload.json"))
}

pub fn load(app: &AppHandle) -> Result<Option<Value>, String> {
    let path = data_path(app)?;
    load_from(&path)
}

fn workspace_version(value: &Value) -> Option<f64> {
    value.get("version").and_then(Value::as_f64)
}

fn is_newer_workspace(value: &Value) -> bool {
    workspace_version(value).is_some_and(|version| version > 1.0)
}

fn load_from(path: &Path) -> Result<Option<Value>, String> {
    let primary = inspect(path);
    let primary_missing = matches!(&primary, FileState::Missing);
    let primary_newer =
        matches!(&primary, FileState::Valid { value, .. } if is_newer_workspace(value));
    let primary_error = match primary {
        FileState::Valid { value, .. } if !is_newer_workspace(&value) => return Ok(Some(value)),
        FileState::Valid { value, .. } => format!(
            "{} was written by a newer version of Payload ({})",
            path.display(),
            workspace_version(&value).unwrap_or_default()
        ),
        FileState::Missing => format!("{} does not exist", path.display()),
        FileState::Invalid { error } | FileState::Unreadable { error } => error,
    };

    let backup = backup_path(path);
    match inspect(&backup) {
        FileState::Valid { bytes, value } if !is_newer_workspace(&value) => {
            if !primary_missing {
                let _ = quarantine(path, if primary_newer { "newer" } else { "corrupt" });
            }
            let _ = atomic_write(path, &bytes);
            Ok(Some(value))
        }
        FileState::Valid { value, .. } => Err(format!(
            "Could not load workspace data: {primary_error}; backup {} was also written by a newer version of Payload ({})",
            backup.display(),
            workspace_version(&value).unwrap_or_default()
        )),
        FileState::Missing if primary_missing => Ok(None),
        FileState::Missing => Err(format!(
            "Could not load workspace data: {primary_error}; backup {} does not exist",
            backup.display()
        )),
        FileState::Invalid { error } | FileState::Unreadable { error } => Err(format!(
            "Could not load workspace data: {primary_error}; backup {error}"
        )),
    }
}

pub fn save(app: &AppHandle, data: Value) -> Result<(), String> {
    let path = data_path(app)?;
    save_to(&path, &data)
}

fn save_to(path: &Path, data: &Value) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(data)
        .map_err(|error| format!("Could not encode workspace data: {error}"))?;
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Could not create {} while saving {}: {error}",
                parent.display(),
                path.display()
            )
        })?;
    }

    let backup = backup_path(path);
    match inspect(path) {
        FileState::Missing => {}
        FileState::Unreadable { error } => {
            return Err(format!(
                "Could not save workspace data because the existing file cannot be inspected: {error}"
            ));
        }
        FileState::Valid {
            bytes: current,
            value,
        } => {
            if is_newer_workspace(&value) {
                return Err(format!(
                    "Refusing to overwrite {} because it was written by a newer version of Payload",
                    path.display()
                ));
            }
            match inspect(&backup) {
                FileState::Missing => {}
                FileState::Valid { value, .. } if is_newer_workspace(&value) => {
                    quarantine(&backup, "newer")?;
                }
                FileState::Valid { .. } => {}
                FileState::Invalid { .. } => {
                    quarantine(&backup, "corrupt")?;
                }
                FileState::Unreadable { error } => {
                    return Err(format!(
                        "Could not save workspace data because the existing backup cannot be inspected: {error}"
                    ));
                }
            }
            atomic_write(&backup, &current)?;
        }
        FileState::Invalid { .. } => {
            quarantine(path, "corrupt")?;
        }
    }

    atomic_write(path, &bytes)
}

enum FileState {
    Missing,
    Valid { bytes: Vec<u8>, value: Value },
    Invalid { error: String },
    Unreadable { error: String },
}

fn inspect(path: &Path) -> FileState {
    match fs::read(path) {
        Ok(bytes) => match serde_json::from_slice::<Value>(&bytes) {
            Ok(value) => FileState::Valid { bytes, value },
            Err(error) => FileState::Invalid {
                error: format!("{} does not contain valid JSON: {error}", path.display()),
            },
        },
        Err(error) if error.kind() == ErrorKind::NotFound => FileState::Missing,
        Err(error) => FileState::Unreadable {
            error: format!("Could not read {}: {error}", path.display()),
        },
    }
}

fn backup_path(path: &Path) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(".bak");
    PathBuf::from(name)
}

fn unique_suffix() -> String {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or(0);
    let counter = UNIQUE_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{stamp}-{}-{counter}", std::process::id())
}

fn unique_sibling(path: &Path, label: &str) -> Result<PathBuf, String> {
    let file_name = path.file_name().ok_or_else(|| {
        format!(
            "Could not derive a unique sibling name for {}",
            path.display()
        )
    })?;
    let mut name = file_name.to_os_string();
    name.push(format!(".{label}-{}", unique_suffix()));
    Ok(path.with_file_name(name))
}

fn quarantine(path: &Path, label: &str) -> Result<PathBuf, String> {
    let target = unique_sibling(path, label)?;
    fs::copy(path, &target).map_err(|error| {
        format!(
            "Could not preserve data at {} as {}: {error}",
            path.display(),
            target.display()
        )
    })?;
    Ok(target)
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temp = unique_sibling(path, "tmp")?;
    let outcome = (|| -> std::io::Result<()> {
        let mut file = fs::File::create(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temp, path)
    })();
    if let Err(error) = outcome {
        let _ = fs::remove_file(&temp);
        return Err(format!("Could not write {}: {error}", path.display()));
    }

    #[cfg(unix)]
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        if let Ok(directory) = fs::File::open(parent) {
            let _ = directory.sync_all();
        }
    }
    Ok(())
}

pub fn read_text(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| error.to_string())
}

pub fn write_text(path: &str, contents: &str) -> Result<(), String> {
    if let Some(dir) = PathBuf::from(path).parent() {
        fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    }
    fs::write(path, contents).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct TempDir {
        path: PathBuf,
    }

    impl TempDir {
        fn new(label: &str) -> Self {
            let path =
                std::env::temp_dir().join(format!("payload-storage-{label}-{}", unique_suffix()));
            fs::create_dir_all(&path).expect("create temp directory");
            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }

        fn join(&self, name: &str) -> PathBuf {
            self.path.join(name)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn primary_path(dir: &TempDir) -> PathBuf {
        dir.join("payload.json")
    }

    fn backup_path_for(dir: &TempDir) -> PathBuf {
        backup_path(&primary_path(dir))
    }

    fn write_bytes(path: &Path, contents: &[u8]) {
        fs::write(path, contents).expect("write test file");
    }

    fn read_bytes(path: &Path) -> Vec<u8> {
        fs::read(path).expect("read test file")
    }

    fn read_value(path: &Path) -> Value {
        serde_json::from_slice(&read_bytes(path)).expect("parse test file")
    }

    fn siblings_containing(dir: &TempDir, needle: &str) -> Vec<PathBuf> {
        let mut found: Vec<PathBuf> = fs::read_dir(dir.path())
            .expect("list temp directory")
            .map(|entry| entry.expect("read entry").path())
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.contains(needle))
            })
            .collect();
        found.sort();
        found
    }

    #[test]
    fn missing_primary_and_backup_returns_none() {
        let dir = TempDir::new("missing-both");
        let loaded = load_from(&primary_path(&dir)).expect("load should succeed");
        assert!(loaded.is_none());
        assert!(siblings_containing(&dir, ".corrupt-").is_empty());
        assert!(!backup_path_for(&dir).exists());
    }

    #[test]
    fn valid_primary_is_loaded_without_touching_corrupt_backup() {
        let dir = TempDir::new("valid-primary-corrupt-backup");
        let primary = primary_path(&dir);
        let backup = backup_path_for(&dir);
        let expected = json!({"workspace": "primary"});
        let corrupt_backup = b"{not valid backup json";
        write_bytes(&primary, br#"{"workspace":"primary"}"#);
        write_bytes(&backup, corrupt_backup);

        let loaded = load_from(&primary).expect("load should succeed");

        assert_eq!(loaded, Some(expected));
        assert_eq!(read_bytes(&backup), corrupt_backup);
        assert!(siblings_containing(&dir, ".corrupt-").is_empty());
    }

    #[test]
    fn missing_primary_recovers_from_backup_and_repairs_primary() {
        let dir = TempDir::new("missing-primary-valid-backup");
        let primary = primary_path(&dir);
        let backup = backup_path_for(&dir);
        let expected = json!({"workspace": "recovered"});
        let backup_bytes = serde_json::to_vec_pretty(&expected).expect("encode backup");
        write_bytes(&backup, &backup_bytes);

        let loaded = load_from(&primary).expect("load should succeed");

        assert_eq!(loaded, Some(expected.clone()));
        assert_eq!(read_value(&primary), expected);
        assert_eq!(read_bytes(&backup), backup_bytes);
        assert!(siblings_containing(&dir, ".corrupt-").is_empty());
    }

    #[test]
    fn corrupt_primary_recovers_from_backup_and_preserves_corrupt_bytes() {
        let dir = TempDir::new("corrupt-primary-valid-backup");
        let primary = primary_path(&dir);
        let backup = backup_path_for(&dir);
        let corrupt_primary = b"{ this is not json";
        let expected = json!({"workspace": "backup"});
        let backup_bytes = serde_json::to_vec_pretty(&expected).expect("encode backup");
        write_bytes(&primary, corrupt_primary);
        write_bytes(&backup, &backup_bytes);

        let loaded = load_from(&primary).expect("load should succeed");

        assert_eq!(loaded, Some(expected.clone()));
        assert_eq!(read_value(&primary), expected);
        let quarantined = siblings_containing(&dir, ".corrupt-");
        assert_eq!(quarantined.len(), 1);
        assert_eq!(read_bytes(&quarantined[0]), corrupt_primary);
        assert_eq!(read_bytes(&backup), backup_bytes);
    }

    #[test]
    fn corrupt_primary_and_backup_fail_without_modifying_files() {
        let dir = TempDir::new("corrupt-both");
        let primary = primary_path(&dir);
        let backup = backup_path_for(&dir);
        let corrupt_primary = b"not primary json";
        let corrupt_backup = b"not backup json";
        write_bytes(&primary, corrupt_primary);
        write_bytes(&backup, corrupt_backup);

        let error = load_from(&primary).expect_err("load should fail");

        assert!(error.contains(&primary.display().to_string()));
        assert!(error.contains(&backup.display().to_string()));
        assert_eq!(read_bytes(&primary), corrupt_primary);
        assert_eq!(read_bytes(&backup), corrupt_backup);
        assert!(siblings_containing(&dir, ".corrupt-").is_empty());
    }

    #[test]
    fn two_saves_keep_previous_value_in_backup() {
        let dir = TempDir::new("two-saves");
        let primary = primary_path(&dir);
        let backup = backup_path_for(&dir);
        let first = json!({"workspace": "first"});
        let second = json!({"workspace": "second"});

        save_to(&primary, &first).expect("first save");
        save_to(&primary, &second).expect("second save");

        assert_eq!(read_value(&primary), second);
        assert_eq!(read_value(&backup), first);
        assert!(siblings_containing(&dir, ".tmp-").is_empty());
        assert!(siblings_containing(&dir, ".corrupt-").is_empty());
    }

    #[test]
    fn saves_quarantine_corrupt_files_and_rebuild_backup() {
        let dir = TempDir::new("recover-corrupt-both");
        let primary = primary_path(&dir);
        let backup = backup_path_for(&dir);
        let corrupt_primary = b"corrupt primary payload";
        let corrupt_backup = b"corrupt backup payload";
        write_bytes(&primary, corrupt_primary);
        write_bytes(&backup, corrupt_backup);
        let first = json!({"workspace": "first"});
        let second = json!({"workspace": "second"});

        save_to(&primary, &first).expect("first save");
        save_to(&primary, &second).expect("second save");

        assert_eq!(read_value(&primary), second);
        assert_eq!(read_value(&backup), first);
        let quarantined = siblings_containing(&dir, ".corrupt-");
        assert_eq!(quarantined.len(), 2);
        let preserved: Vec<Vec<u8>> = quarantined.iter().map(|path| read_bytes(path)).collect();
        assert!(preserved.contains(&corrupt_primary.to_vec()));
        assert!(preserved.contains(&corrupt_backup.to_vec()));
        assert!(siblings_containing(&dir, ".tmp-").is_empty());
    }

    #[test]
    fn save_quarantines_corrupt_backup_before_replacing_it() {
        let dir = TempDir::new("valid-primary-corrupt-backup-save");
        let primary = primary_path(&dir);
        let backup = backup_path_for(&dir);
        let first = json!({"workspace": "first"});
        save_to(&primary, &first).expect("first save");
        let corrupt_backup = b"corrupt backup contents";
        write_bytes(&backup, corrupt_backup);
        let second = json!({"workspace": "second"});

        save_to(&primary, &second).expect("second save");

        assert_eq!(read_value(&primary), second);
        assert_eq!(read_value(&backup), first);
        let quarantined = siblings_containing(&dir, ".corrupt-");
        assert_eq!(quarantined.len(), 1);
        assert_eq!(read_bytes(&quarantined[0]), corrupt_backup);
        assert!(siblings_containing(&dir, ".tmp-").is_empty());
    }

    #[test]
    fn save_refuses_to_replace_a_directory() {
        let dir = TempDir::new("primary-is-directory");
        let primary = primary_path(&dir);
        fs::create_dir(&primary).expect("create directory at primary path");
        let marker = primary.join("marker.txt");
        write_bytes(&marker, b"keep me");

        let error = save_to(&primary, &json!({"workspace": "new"})).expect_err("save should fail");

        assert!(!error.is_empty());
        assert!(primary.is_dir());
        assert_eq!(read_bytes(&marker), b"keep me");
        assert!(siblings_containing(&dir, ".tmp-").is_empty());
        assert!(!backup_path_for(&dir).exists());
    }

    #[test]
    fn load_recovers_from_backup_when_primary_has_a_newer_version() {
        let dir = TempDir::new("newer-primary-valid-backup");
        let primary = primary_path(&dir);
        let backup = backup_path_for(&dir);
        let newer = br#"{"version":2,"workspace":"newer"}"#;
        let expected = json!({"version": 1, "workspace": "backup"});
        let backup_bytes = serde_json::to_vec_pretty(&expected).expect("encode backup");
        write_bytes(&primary, newer);
        write_bytes(&backup, &backup_bytes);

        let loaded = load_from(&primary).expect("load should succeed");

        assert_eq!(loaded, Some(expected.clone()));
        assert_eq!(read_value(&primary), expected);
        assert_eq!(read_bytes(&backup), backup_bytes);
        let preserved = siblings_containing(&dir, ".newer-");
        assert_eq!(preserved.len(), 1);
        assert_eq!(read_bytes(&preserved[0]), newer);
        assert!(siblings_containing(&dir, ".corrupt-").is_empty());
    }

    #[test]
    fn load_fails_when_only_a_newer_workspace_exists() {
        let dir = TempDir::new("newer-primary-no-backup");
        let primary = primary_path(&dir);
        let newer = br#"{"version":2}"#;
        write_bytes(&primary, newer);

        let error = load_from(&primary).expect_err("load should fail");

        assert!(error.contains(&primary.display().to_string()));
        assert_eq!(read_bytes(&primary), newer);
        assert!(siblings_containing(&dir, ".newer-").is_empty());
    }

    #[test]
    fn save_refuses_to_overwrite_a_newer_primary() {
        let dir = TempDir::new("save-newer-primary");
        let primary = primary_path(&dir);
        let backup = backup_path_for(&dir);
        let newer = br#"{"version":2}"#;
        let backup_bytes = br#"{"version":1,"workspace":"backup"}"#;
        write_bytes(&primary, newer);
        write_bytes(&backup, backup_bytes);

        let error = save_to(&primary, &json!({"version": 1})).expect_err("save should fail");

        assert!(error.contains("newer version"));
        assert_eq!(read_bytes(&primary), newer);
        assert_eq!(read_bytes(&backup), backup_bytes);
        assert!(siblings_containing(&dir, ".tmp-").is_empty());
        assert!(siblings_containing(&dir, ".newer-").is_empty());
    }

    #[test]
    fn save_preserves_a_newer_backup_before_replacing_it() {
        let dir = TempDir::new("save-newer-backup");
        let primary = primary_path(&dir);
        let backup = backup_path_for(&dir);
        let first = json!({"version": 1, "workspace": "first"});
        let second = json!({"version": 1, "workspace": "second"});
        let newer = br#"{"version":2,"workspace":"newer"}"#;
        save_to(&primary, &first).expect("first save");
        write_bytes(&backup, newer);

        save_to(&primary, &second).expect("second save");

        assert_eq!(read_value(&primary), second);
        assert_eq!(read_value(&backup), first);
        let preserved = siblings_containing(&dir, ".newer-");
        assert_eq!(preserved.len(), 1);
        assert_eq!(read_bytes(&preserved[0]), newer);
        assert!(siblings_containing(&dir, ".tmp-").is_empty());
    }
}
