$port = 3002
$proc = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($proc) {
  Write-Host "Porta $port ocupada. Encerrando processo $proc..."
  Stop-Process -Id $proc -Force
  Start-Sleep 1
}

Write-Host "Iniciando servidor na porta $port em background..."
$p = Start-Process -NoNewWindow node "backend\server.js" -PassThru
Write-Host "Servidor rodando (PID: $($p.Id))"
Write-Host "Para parar:  Stop-Process -Id $($p.Id)"
