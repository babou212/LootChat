#!/bin/bash
# Script to retrieve WireGuard client configuration from the cluster

echo "Waiting for WireGuard pod to be ready..."
kubectl wait --for=condition=ready pod -l app=wireguard -n wireguard --timeout=120s

POD=$(kubectl get pod -n wireguard -l app=wireguard -o jsonpath='{.items[0].metadata.name}')

echo "Getting WireGuard configuration for peer1..."
echo ""
echo "=== WireGuard Client Configuration (peer1) ==="
kubectl exec -n wireguard $POD -- cat /config/peer1/peer1.conf

echo ""
echo ""
echo "=== QR Code for Mobile (if available) ==="
kubectl exec -n wireguard $POD -- cat /config/peer1/peer1.png 2>/dev/null || echo "QR code not available"

echo ""
echo ""
echo "=== WireGuard Server Connection Info ==="
NODEPORT=$(kubectl get svc wireguard -n wireguard -o jsonpath='{.spec.ports[0].nodePort}')
# Get any worker node IP (all workers have the service)
NODE_IP=$(kubectl get nodes -l '!node-role.kubernetes.io/control-plane' -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}')

if [ -z "$NODE_IP" ]; then
    # Fallback: try to get from terraform output
    NODE_IP="46.224.56.167"  # First worker from terraform
fi

echo "Server: $NODE_IP:$NODEPORT"
echo ""
echo "NOTE: Update the Endpoint in the config above to: $NODE_IP:$NODEPORT"

echo ""
echo "=== Instructions ==="
echo "1. Save the configuration above to a file (e.g., wg0.conf)"
echo "2. Update the Endpoint line to: Endpoint = $NODE_IP:$NODEPORT"
echo "3. Install WireGuard on your client device"
echo "4. Import the configuration or use: wg-quick up wg0.conf"
echo "5. Once connected, access Grafana at: http://grafana"
echo ""
