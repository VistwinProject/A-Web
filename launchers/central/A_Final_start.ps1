param([switch]$ValidateOnly,[switch]$TestMode)
$ErrorActionPreference='Stop'
$desktopRoot=$PSScriptRoot
$tdFile=Join-Path $desktopRoot 'Final_A_TD/Final_A_TD.toe'
$webRoot=Join-Path $desktopRoot 'Final_A_Web'
$tdExe='C:/Program Files/Derivative/TouchDesigner/bin/TouchDesigner.exe'
$nodeExe='C:/Program Files/nodejs/node.exe'
$log=Join-Path $webRoot 'A_Final_start.log'
function Get-FinalAudioHash($path){
 $hash=[Security.Cryptography.SHA256]::Create()
 $stream=[IO.File]::OpenRead($path)
 try{return [BitConverter]::ToString($hash.ComputeHash($stream))}finally{$stream.Dispose();$hash.Dispose()}
}
function Invoke-TD($script,$timeout=3){
 $body=@{script=$script;mode='full-exec'}|ConvertTo-Json
 $reply=Invoke-RestMethod 'http://127.0.0.1:9983/api/td/server/exec' -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec $timeout
 if(-not $reply.success){throw $reply.error}
 return $reply.data.result
}
try {
 foreach($file in @($tdFile,$tdExe,$nodeExe,(Join-Path $webRoot 'server.mjs'),(Join-Path $webRoot 'config.json'),(Join-Path $desktopRoot 'Final_A_TD/media/audio/A區 互動 music_1005.wav'))){if(-not(Test-Path -LiteralPath $file)){throw "Missing: $file"}}
 if($ValidateOnly){'Final files and executables verified';return}
 $scene5Source=Join-Path $desktopRoot 'AC/A區/A/media/audio/A_Scene5_BGM.mp3'
 $scene5Final=Join-Path $desktopRoot 'Final_A_TD/media/audio/A_Scene5_BGM.mp3'
 if(Test-Path -LiteralPath $scene5Source){
  if(-not(Test-Path -LiteralPath $scene5Final) -or (Get-FinalAudioHash $scene5Source) -ne (Get-FinalAudioHash $scene5Final)){Copy-Item -LiteralPath $scene5Source -Destination $scene5Final -Force}
 }
 "Start $(Get-Date -Format s)" | Add-Content -LiteralPath $log
 $current=$null
 try{$current=Invoke-TD "result={'folder':project.folder,'name':project.name}"}catch{}
 if($current){
  if($current.folder.Replace('\','/').TrimEnd('/') -ne (Split-Path $tdFile).Replace('\','/').TrimEnd('/')){
   $pythonPath=($tdFile.Replace('\','/')|ConvertTo-Json -Compress)
   Invoke-TD "import td; td.run('project.load(args[0])', $pythonPath, delayFrames=1); result={'loading':True}" | Out-Null
  }
 }else{
  if(Get-Process TouchDesigner -ErrorAction SilentlyContinue){throw 'TouchDesigner is running but MCP 9983 is unavailable. Close the extra TD instance before retrying.'}
  Start-Process -FilePath $tdExe -ArgumentList ('"'+$tdFile+'"') -WorkingDirectory (Split-Path $tdFile)
 }
 $tdReady=$false
 for($attempt=0;$attempt -lt 120;$attempt++){
  try{
   $current=Invoke-TD "result={'folder':project.folder,'name':project.name}"
   if($current.folder.Replace('\','/').TrimEnd('/') -eq (Split-Path $tdFile).Replace('\','/').TrimEnd('/')){$tdReady=$true;break}
  }catch{}
  Start-Sleep -Milliseconds 500
 }
 if(-not $tdReady){throw 'Final_A_TD did not become ready; see this log.'}
 $webReady=$false
 $webProcesses=Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -and ($_.CommandLine.Contains('AC\A區\A\web\A_ZONE_OSC\server.mjs') -or $_.CommandLine.Contains('AC/A區/A/web/A_ZONE_OSC/server.mjs'))}
 foreach($process in $webProcesses){Stop-Process -Id $process.ProcessId -Force}
 try{$status=Invoke-RestMethod 'http://127.0.0.1:8788/api/status' -TimeoutSec 2;$webReady=$null -ne $status.replyPort}catch{}
 if(-not $webReady){
  Start-Process -FilePath $nodeExe -ArgumentList ('"'+(Join-Path $webRoot 'server.mjs')+'"') -WorkingDirectory $webRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $webRoot 'local-web.log') -RedirectStandardError (Join-Path $webRoot 'local-web-error.log')
 }
 Invoke-TD @"
master=op('/project1/PROJECTION_MASTER')
master.par.Receiveport=9200; master.par.Forwardport=9201; master.par.Baddress='192.168.168.143'
op('/project1/B_SYNC').par.Baddress='192.168.168.143';op('/project1/B_SYNC').par.Port=9100
op('/project1/FLOOR_WINDOW').par.display=1
op('/project1/window2').par.display=1
master.par.View=0
op('/project1/FLOOR_WINDOW').par.winclose.pulse()
for path,display in (('/project1/window2',1),):
    w=op(path);w.par.winclose.pulse();w.par.display=display;w.par.justifyoffsetto='specifydisplay';w.par.size='fill';w.par.borders=False;w.par.alwaysontop=True;w.par.cursorvisible='never';w.par.performance=False
op('/project1/FLOOR_WINDOW').par.winclose.pulse()
op('/project1/window2').par.winop='/project1/CENTER_OPAQUE_OUTPUT'
op('/project1/window2').par.winopen.pulse()
audioPaths=['/project1/audiofilein1','/project1/audiodevout1','/project1/Scene1/audiofilein1','/project1/Scene1/audiodevout1','/project1/Scene5/audiofilein1','/project1/Scene5/audiodevout1']
missing=[p for p in audioPaths if op(p) is None]
if missing:raise Exception('Missing final audio nodes: '+str(missing))
logic=op('/project1/SHOW_logic').module
if not hasattr(logic,'background_audio_gain') or not hasattr(logic,'s5_audio_gain'):raise Exception('Final TD audio controls are outdated')
op('/project1/audiofilein1').par.play=True
op('/project1/Scene5/audiofilein1').par.reloadpulse.pulse()
logic.step()
result={'configured':True,'audioReady':True}
"@ 10 | Out-Null
 for($attempt=0;$attempt -lt 30;$attempt++){
  try{$status=Invoke-RestMethod 'http://127.0.0.1:8788/api/status' -TimeoutSec 2;if($status.connected){$webReady=$true;break}}catch{}
  Start-Sleep -Milliseconds 500
 }
 if(-not $webReady){throw 'Final WEB is not ready; see local-web-error.log.'}
 Invoke-RestMethod 'http://127.0.0.1:8788/api/action' -Method Post -ContentType 'application/json' -Body '{"action":"reset"}' -TimeoutSec 5 | Out-Null
 Start-Process 'http://127.0.0.1:8788/A_ZONE_OSC.html?phonefix=5'
 "Ready: $($current.name) | Web 8788 | OSC 9200/9202 | B 192.168.168.143" | Add-Content -LiteralPath $log
}catch{
 $_ | Out-String | Add-Content -LiteralPath $log
 Add-Type -AssemblyName System.Windows.Forms
 if(-not $TestMode){[System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'A Final startup') | Out-Null}
 throw
}
