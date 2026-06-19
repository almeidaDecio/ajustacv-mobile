$port = 3002
$proc = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($proc) {
  Stop-Process -Id $proc -Force
  Write-Host "Servidor na porta $port encerrado (PID: $proc)."
} else {
  Write-Host "Nenhum processo rodando na porta $port."
}
