$env:Path = "C:\Users\Administrator\.cargo\bin;" + $env:Path
Set-Location E:\projects\rprint
npm run tauri build -- --no-bundle
