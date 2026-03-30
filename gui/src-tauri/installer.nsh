!macro customInstall
  # Register .mpr extension
  WriteRegStr HKCR ".mpr" "" "Macropad.Recording"
  WriteRegStr HKCR "Macropad.Recording" "" "Macropad binary recording file"
  # Path points to the bundled icon in the flat resources folder
  WriteRegStr HKCR "Macropad.Recording\DefaultIcon" "" "$INSTDIR\resources\MPR_Icon.ico"
  WriteRegStr HKCR "Macropad.Recording\shell\open\command" "" '"$INSTDIR\Macropad.exe" "%1"'

  # Register .mps extension
  WriteRegStr HKCR ".mps" "" "Macropad.Script"
  WriteRegStr HKCR "Macropad.Script" "" "Macropad automation script"
  # Path points to the bundled icon in the flat resources folder
  WriteRegStr HKCR "Macropad.Script\DefaultIcon" "" "$INSTDIR\resources\MPS_Icon.ico"
  WriteRegStr HKCR "Macropad.Script\shell\open\command" "" '"$INSTDIR\Macropad.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCR ".mpr"
  DeleteRegKey HKCR "Macropad.Recording"
  DeleteRegKey HKCR ".mps"
  DeleteRegKey HKCR "Macropad.Script"
!macroend
