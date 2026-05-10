Set WshShell = CreateObject("WScript.Shell")
args = ""
If WScript.Arguments.Count > 0 Then
    args = " """ & WScript.Arguments(0) & """"
End If
WshShell.Run """C:\Program Files\nodejs\node.exe""" & " ""C:\GitHub\opencode-studio\server\cli.js"" " & args, 0, False
