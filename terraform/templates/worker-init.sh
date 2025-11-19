#!/bin/bash
set -e

# Log everything
exec > >(tee -a /var/log/worker-init.log)
exec 2>&1

echo "=========================================="
echo "Initializing Kubernetes Worker Node"
echo "=========================================="
echo "Kubernetes Version: ${kubernetes_version}"
echo "Control Plane IP: ${control_plane_ip}"
echo "Architecture: ${server_arch}"
echo "=========================================="

# Detect architecture
ARCH="${server_arch}"
if [ "$ARCH" = "arm64" ]; then
    echo "Using ARM64 architecture"
else
    ARCH="amd64"
    echo "Using AMD64 architecture"
fi

# Update system
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y

# Install prerequisites
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common

# Disable swap
swapoff -a
sed -i '/ swap / s/^/#/' /etc/fstab

# Load kernel modules
cat <<EOF | tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

modprobe overlay
modprobe br_netfilter

# Configure sysctl
cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sysctl --system

# Install containerd
apt-get install -y containerd
mkdir -p /etc/containerd
containerd config default | tee /etc/containerd/config.toml
sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
systemctl restart containerd
systemctl enable containerd

# Install Kubernetes packages
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /" | tee /etc/apt/sources.list.d/kubernetes.list

apt-get update
apt-get install -y kubelet=${kubernetes_version}-* kubeadm=${kubernetes_version}-*
apt-mark hold kubelet kubeadm

# Get private IP
PRIVATE_IP=$(hostname -I | awk '{print $2}')
echo "KUBELET_EXTRA_ARGS=--node-ip=$PRIVATE_IP" > /etc/default/kubelet

# Wait for control plane to be ready and get join command
echo "Waiting for control plane to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Try to get the join command from control plane
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@${control_plane_ip} "test -f /root/.k8s-init-complete" 2>/dev/null; then
        echo "Control plane is ready, retrieving join command..."
        JOIN_COMMAND=$(ssh -o StrictHostKeyChecking=no root@${control_plane_ip} "cat /root/join-command.sh")
        
        if [ -n "$JOIN_COMMAND" ]; then
            echo "Join command retrieved successfully"
            break
        fi
    fi
    
    echo "Waiting for control plane... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
    sleep 10
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERROR: Timeout waiting for control plane to be ready"
    exit 1
fi

# Join the cluster
echo "Joining the cluster..."
eval "$JOIN_COMMAND"

# Wait for node to be ready
echo "Waiting for node to become ready..."
sleep 30

echo "=========================================="
echo "Worker Node Initialization Complete!"
echo "=========================================="
echo "Node has joined the cluster"
echo "Check status on control plane with:"
echo "  kubectl get nodes"
echo "=========================================="
