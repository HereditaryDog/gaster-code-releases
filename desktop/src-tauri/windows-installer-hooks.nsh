!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping running Gaster Code sidecars..."
  nsExec::ExecToLog 'taskkill /F /T /IM gaster-sidecar-x86_64-pc-windows-msvc.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM gaster-sidecar-aarch64-pc-windows-msvc.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM gaster-sidecar.exe'
  Pop $0
  Sleep 1000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping running Gaster Code processes..."
  nsExec::ExecToLog 'taskkill /F /T /IM gaster-code-desktop.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM gaster-sidecar-x86_64-pc-windows-msvc.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM gaster-sidecar-aarch64-pc-windows-msvc.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM gaster-sidecar.exe'
  Pop $0
  Sleep 1000
!macroend
