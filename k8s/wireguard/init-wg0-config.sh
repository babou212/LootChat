#!/bin/bash
# This script generates the WireGuard server config from Kubernetes Secret

mkdir -p /config/wg_confs

cat > /config/wg_confs/wg0.conf << EOF
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = $(cat /run/secrets/wireguard/server-private-key)
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
PublicKey = $(cat /run/secrets/wireguard/peer1-public-key)
PresharedKey = $(cat /run/secrets/wireguard/peer1-preshared-key)
AllowedIPs = 10.8.0.2/32,10.96.0.0/12,10.244.0.0/16
EOF

echo "WireGuard config generated at /config/wg_confs/wg0.conf"
