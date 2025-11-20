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
echo "=== WireGuard Server Public IP ==="
kubectl get svc wireguard -n wireguard -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
echo ""

echo ""
echo "=== Instructions ==="
echo "1. Save the configuration above to a file (e.g., wg0.conf)"
echo "2. Install WireGuard on your client device"
echo "3. Import the configuration or use: wg-quick up wg0.conf"
echo "4. Once connected, access Grafana at: http://grafana"
echo ""
