@echo off
setlocal
set "A_LR_LAUNCHER=%~f0"
set "A_LR_PROJECT=%~dp0A_LR_Final_TD.toe"
powershell.exe -NoProfile -WindowStyle Hidden -Command "$s=[IO.File]::ReadAllText($env:A_LR_LAUNCHER); & ([scriptblock]::Create(($s -split '(?m)^# PS_START\r?$',2)[1]))"
exit /b %errorlevel%
# PS_START
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Diagnostics; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class ALRWindow {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct Device {
 public int cb; [MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)] public string name;
 [MarshalAs(UnmanagedType.ByValTStr,SizeConst=128)] public string description; public int flags;
 [MarshalAs(UnmanagedType.ByValTStr,SizeConst=128)] public string id;
 [MarshalAs(UnmanagedType.ByValTStr,SizeConst=128)] public string key; }
 public delegate bool Callback(IntPtr h,IntPtr p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern bool EnumDisplayDevices(string n,int i,ref Device d,int flags);
 [DllImport("user32.dll")] static extern bool EnumWindows(Callback c,IntPtr p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint id);
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int command);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left,top,right,bottom; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 public static string MonitorId(string n) { Device d=new Device();d.cb=Marshal.SizeOf(typeof(Device));return EnumDisplayDevices(n,0,ref d,1)?d.id:""; }
 public static IntPtr[] Editors() {
 var found=new List<IntPtr>();
 EnumWindows(delegate(IntPtr h,IntPtr p) {
 var s=new StringBuilder(1024);GetWindowText(h,s,s.Capacity);string title=s.ToString();
 if (!title.StartsWith("TouchDesigner",StringComparison.OrdinalIgnoreCase)||title.IndexOf("A_LR_Final_TD",StringComparison.OrdinalIgnoreCase)<0) return true;
 uint id;GetWindowThreadProcessId(h,out id);
 try {if(Process.GetProcessById((int)id).ProcessName=="TouchDesigner")found.Add(h);}catch{}
 return true;},IntPtr.Zero);return found.ToArray(); }
}
'@
try {
 $taskScreens=@([System.Windows.Forms.Screen]::AllScreens | Where-Object {[ALRWindow]::MonitorId($_.DeviceName) -like '*KTC2154*'})
 if($taskScreens.Count -ne 1){throw 'Connect the WS050R maintenance monitor and run this launcher again.'}
 $taskArea=$taskScreens[0].WorkingArea
 $taskWidth=[Math]::Min(960,$taskArea.Width-80);$taskHeight=[Math]::Min(760,$taskArea.Height-80)
 $taskX=$taskArea.Left+[int](($taskArea.Width-$taskWidth)/2);$taskY=$taskArea.Top+[int](($taskArea.Height-$taskHeight)/2)
 $taskWindows=@([ALRWindow]::Editors())
 if($taskWindows.Count -eq 0){
  if(Get-Process -Name TouchDesigner -ErrorAction SilentlyContinue){throw 'Another TD project is running. Close it, then run A_LR_Final_cmd again.'}
  $taskExe='C:\Program Files\Derivative\TouchDesigner\bin\TouchDesigner.exe'
  if(!(Test-Path -LiteralPath $taskExe)){throw 'TouchDesigner is missing.'}
  if(!(Test-Path -LiteralPath $env:A_LR_PROJECT)){throw 'Keep A_LR_Final_TD.toe beside this launcher.'}
  Start-Process -FilePath $taskExe -ArgumentList ('"'+$env:A_LR_PROJECT+'"') -WindowStyle Normal | Out-Null
 }
 $taskDeadline=[DateTime]::UtcNow.AddSeconds(120)
 do {
  $taskWindows=@([ALRWindow]::Editors());if($taskWindows.Count -eq 1){break}
  Start-Sleep -Milliseconds 500
 }while([DateTime]::UtcNow -lt $taskDeadline)
 if($taskWindows.Count -ne 1){throw 'Could not identify one final TD editor window.'}
 $taskHandle=$taskWindows[0]
 [ALRWindow]::ShowWindowAsync($taskHandle,9)|Out-Null
 Start-Sleep -Milliseconds 300
 # NOZORDER + NOACTIVATE: leave both projector windows alone.
 if(![ALRWindow]::SetWindowPos($taskHandle,[IntPtr]::Zero,$taskX,$taskY,$taskWidth,$taskHeight,0x14)){throw 'Could not position the editor.'}
 Start-Sleep -Seconds 3
 [ALRWindow]::SetWindowPos($taskHandle,[IntPtr]::Zero,$taskX,$taskY,$taskWidth,$taskHeight,0x14)|Out-Null
 $taskRect=New-Object ALRWindow+Rect
 [ALRWindow]::GetWindowRect($taskHandle,[ref]$taskRect)|Out-Null
 if($taskRect.left -lt $taskArea.Left -or $taskRect.right -gt $taskArea.Right -or $taskRect.top -lt $taskArea.Top -or $taskRect.bottom -gt $taskArea.Bottom){throw 'The editor did not fit inside the maintenance monitor.'}
 exit 0
}catch{
 [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'A_LR Final Launcher')|Out-Null
 exit 1
}
