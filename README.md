# AWS-s3-mc2-lambda-hybrid-cloud
## 📚 Complete AWS Setup Guide - Project 3 (Hybrid Cloud)

Here's a **step-by-step AWS-only guide** you can follow later for any similar project.

---

## Part 1: AWS Services Overview for Project 3

| Service | Purpose | New in Project 3 |
|---------|---------|------------------|
| **EC2** | Host Admin Dashboard + WebSocket Server | ✅ Yes (from Project 1) |
| **S3** | Store images + Host Public Frontend | ✅ Yes (from Project 2) |
| **Lambda** | Serverless API for uploads | ✅ Yes (from Project 2) |
| **API Gateway** | REST API endpoints | ✅ Yes (from Project 2) |
| **DynamoDB** | Store image metadata | ✅ Yes (from Project 2) |
| **SNS** | Send notifications from Lambda to EC2 | 🆕 NEW |
| **IAM** | Permissions for all services | ✅ Yes |

---

## Part 2: Step-by-Step AWS Setup

### Step 1: Set Up EC2 (From Project 1)

**1.1 Launch EC2 Instance**

| Setting | Value |
|---------|-------|
| AMI | Ubuntu 24.04 LTS |
| Instance type | t3.micro (free tier) |
| Key pair | Create new (download .pem file) |
| Storage | 8 GB gp3 |

**1.2 Configure Security Group (Inbound Rules)**

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | My IP | Admin access |
| HTTP | 80 | 0.0.0.0/0 | Admin dashboard |
| HTTPS | 443 | 0.0.0.0/0 | Future SSL |
| Custom TCP | 3003 | 0.0.0.0/0 | WebSocket server (NEW) |

**1.3 Install Required Software on EC2**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2
```

---

### Step 2: Set Up S3 (From Project 2)

**2.1 Create S3 Bucket for Images (Private)**

| Setting | Value |
|---------|-------|
| Bucket name | `task-images-sharif` |
| Region | us-east-1 |
| Block public access | ✅ ON |

**2.2 Create S3 Bucket for Frontend (Public)**

| Setting | Value |
|---------|-------|
| Bucket name | `task-frontend-sharif` |
| Region | us-east-1 |
| Block public access | ❌ OFF |
| Static website hosting | Enable (index.html) |

**2.3 Add Bucket Policy for Public Access**

```json
{
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": "*",
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::task-frontend-sharif/*"
    }]
}
```

---

### Step 3: Set Up DynamoDB (From Project 2)

| Setting | Value |
|---------|-------|
| Table name | `ImageMetadata` |
| Partition key | `imageId` (String) |
| Capacity mode | On-demand |

---

### Step 4: Set Up IAM Role for Lambda (From Project 2)

| Setting | Value |
|---------|-------|
| Role name | `lambda-image-api-role` |
| Trusted entity | AWS service → Lambda |

**Attached Policies:**

| Policy | Purpose |
|--------|---------|
| `AWSLambdaBasicExecutionRole` | CloudWatch logs |
| `AmazonS3FullAccess` | Access S3 buckets |
| `AmazonDynamoDBFullAccess` | Access DynamoDB |
| `AmazonSNSFullAccess` | **NEW** - Publish to SNS |

---

### Step 5: Set Up Lambda Functions (From Project 2 + SNS)

**5.1 Create Lambda: uploadImage**

| Setting | Value |
|---------|-------|
| Runtime | Node.js 20.x |
| Role | `lambda-image-api-role` |

**Environment Variables:**

| Key | Value |
|-----|-------|
| `TABLE_NAME` | `ImageMetadata` |
| `BUCKET_NAME` | `task-images-sharif` |
| `REGION` | `us-east-1` |
| `SNS_TOPIC_ARN` | `arn:aws:sns:us-east-1:xxxx:new-image-uploaded` (NEW) |

**5.2 Create Lambda: listImages**

Same settings, no SNS needed.

**5.3 Create Lambda: getImage**

Same settings, no SNS needed.

---

### Step 6: Set Up API Gateway (From Project 2)

**6.1 Create REST API**

| Setting | Value |
|---------|-------|
| API name | `ImageUploadAPI` |
| Endpoint type | Regional |

**6.2 Create Resources and Methods**

| Resource | Method | Lambda |
|----------|--------|--------|
| `/upload` | POST | `uploadImage` |
| `/images` | GET | `listImages` |
| `/images/{id}` | GET | `getImage` |

**6.3 Deploy API**

| Setting | Value |
|---------|-------|
| Stage | `prod` |

**Copy Invoke URL:** `https://xxxx.execute-api.us-east-1.amazonaws.com/prod`

---

### Step 7: Set Up SNS (NEW for Project 3)

**7.1 Create SNS Topic**

| Setting | Value |
|---------|-------|
| Type | Standard |
| Name | `new-image-uploaded` |
| Display name | `ImageUpload` |

**Copy Topic ARN:** `arn:aws:sns:us-east-1:xxxx:new-image-uploaded`

**7.2 Create SNS Subscription**

| Setting | Value |
|---------|-------|
| Protocol | HTTP |
| Endpoint | `http://<EC2_PUBLIC_IP>/sns-notify` |

**7.3 Verify Subscription**

Status should change from `Pending confirmation` to `Confirmed` (10-20 seconds)

---

### Step 8: Set Up EC2 WebSocket Server (NEW)

**8.1 Create WebSocket Server Files**

```bash
mkdir -p ~/project3-hybrid-cloud/websocket-server
cd ~/project3-hybrid-cloud/websocket-server
npm init -y
npm install ws express body-parser
```

**8.2 Start with PM2**

```bash
pm2 start index.js --name ws-server
pm2 save
pm2 startup
```

**8.3 Verify WebSocket Server**

```bash
pm2 status  # Should show "online"
curl http://localhost:3003/sns-notify  # Should return something
```

---

### Step 9: Configure Nginx (NEW)

**9.1 Create Nginx Config**

File: `/etc/nginx/sites-available/hybrid-app`

**9.2 Key Locations to Add**

| Location | Proxy to | Purpose |
|----------|----------|---------|
| `/` | `/home/ubuntu/.../admin-frontend/dist` | Admin dashboard |
| `/ws` | `http://localhost:3003` | WebSocket |
| `/sns-notify` | `http://localhost:3003/sns-notify` | SNS webhook |

**9.3 Enable Site**

```bash
sudo ln -s /etc/nginx/sites-available/hybrid-app /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

### Step 10: Set Up IAM User for GitHub Actions

**10.1 Create IAM User**

| Setting | Value |
|---------|-------|
| User name | `github-actions` |
| Console access | Disabled |

**10.2 Attach Policies**

| Policy | Purpose |
|--------|---------|
| `AmazonS3FullAccess` | Deploy frontend to S3 |

**10.3 Create Access Keys**

Download the `.csv` file (contains Access Key ID and Secret Access Key)

---

### Step 11: Add GitHub Secrets

Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions`

| Secret Name | Value | Source |
|-------------|-------|--------|
| `EC2_HOST` | EC2 public IP | EC2 Dashboard |
| `EC2_USER` | `ubuntu` | Fixed |
| `EC2_SSH_KEY` | Private key content | `task-manager-key.pem` file |
| `AWS_ACCESS_KEY_ID` | Access key | IAM user .csv file |
| `AWS_SECRET_ACCESS_KEY` | Secret key | IAM user .csv file |
| `VITE_API_URL` | API Gateway URL | API Gateway → Stages → prod |
| `VITE_WS_URL` | `ws://<EC2_IP>:3003` | Your EC2 IP + port 3003 |
| `S3_FRONTEND_BUCKET` | `task-frontend-sharif` | Your S3 bucket name |

---

## Part 3: Deployment Summary

### What Gets Deployed Where

| Component | Deploys To | Via |
|-----------|------------|-----|
| Public Frontend (React) | S3 bucket | GitHub Actions |
| Admin Frontend (React) | EC2 (Nginx) | GitHub Actions + SSH |
| WebSocket Server | EC2 (PM2) | GitHub Actions + SSH |
| Lambda Functions | AWS Lambda | Manual or GitHub Actions |

### Live URLs After Deployment

| App | URL |
|-----|-----|
| Public Upload Page | `http://task-frontend-sharif.s3-website-us-east-1.amazonaws.com` |
| Admin Dashboard | `http://<EC2_PUBLIC_IP>` |

---

## Part 4: Troubleshooting Checklist

| Problem | Check |
|---------|-------|
| WebSocket not connecting | Port 3003 open in security group? |
| SNS subscription pending | EC2 reachable? Nginx configured? |
| Upload fails | Lambda environment variables set? |
| Admin dashboard blank | `.env` file has correct VITE_API_URL? |
| GitHub Actions fails | Secrets added correctly? |

---

## Part 5: Clean Up (Delete Everything)

To avoid charges, delete:

1. **EC2** → Terminate instance
2. **S3** → Empty and delete both buckets
3. **DynamoDB** → Delete `ImageMetadata` table
4. **Lambda** → Delete 3 functions
5. **API Gateway** → Delete API
6. **SNS** → Delete topic and subscriptions
7. **IAM** → Delete `github-actions` user and `lambda-image-api-role`

