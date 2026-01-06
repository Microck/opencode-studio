Set WshShell = CreateObject("WScript.Shell")
args = ""
If WScript.Arguments.Count > 0 Then
    args = " """ & WScript.Arguments(0) & """"
End If
WshShell.Run """C:\node\node.exe""" & " ""C:\Users\Microck\opencode-studio\server\cli.js"" " & args, 0, False
