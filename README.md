# A simple OpenShift Origin Cluster On AWS

## Cookbook Instructions

This repo contains a cloud formation template and ansible scripts for setting up a simple 3-node (1 master, 2 app nodes) OpenShift Origin cluster on AWS.  This started as a short exercise so I could have a cluster at my disposal on which to try things for which minishift on my laptop would not be sufficient.  In the process, I learned a few things that I thought I'd capture.

To give credit its due, I started by reading [this excellent blog post](https://sysdig.com/blog/deploy-openshift-aws/) that describes how to set up a 3.6 cluster.  A lot has changed between 3.6 and 3.9, so getting things working required changes to the cloud formation template, as well as to the inventory file.  More on that later.

Another resource that is very informative is [this](https://github.com/gnunn1/openshift-aws-setup) github repo that has a more sophisticated (and better automated) openshift-on-aws setup.  It relies on ansible to set up the aws environment, as well as the openshift deployment.

Finally - for quick reference, [here's](https://docs.openshift.org/latest/install_config/configuring_aws.html) a link to the openshift origin doc for configuring for aws.

In order to run these scripts, you will need an AWS account, AWS access keys, as well as a key pair.  In order to generate access keys, follow the instructions [here](https://docs.aws.amazon.com/general/latest/gr/managing-aws-access-keys.html).  Access keys are used for programmatic access (e.g. when you run aws cloudformation).  In order to generate an EC2 Key Pair, follow the instructions [here](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html).  You'll associate the key pair with your instances so you can SSH in.

You'll need to set the following environment variables:
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```
You'll also need to install the AWS cli, and call "aws configure" to set yourself up to run.  The doc for that is [here](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html#cli-quick-configuration)

Next, git clone this repo, cd into the directory and
```
git clone https://github.com/openshift/openshift-ansible.git
git checkout release-3.9

```

Having done all that, you will then need to upload [the cloudformation template](../blob/CloudFormationTemplate) to an S3 bucket, and then type the following incantation (substituting your information where you see angle brackets):
```
aws cloudformation create-stack --region us-east-1  \
                                --stack-name <your stack name> \
                                --template-url https://s3.amazonaws.com/<your s3 bucket and filename> \
                                -parameters ParameterKey=AvailabilityZone,ParameterValue=us-east-1e \
                                ParameterKey=KeyName,ParameterValue=<name of your key pair .pem file> --capabilities=CAPABILITY_IAM
```
As it stands, things are hard-coded to run in the us-east-1e zone.  The ami id is also hard coded (It is the official CentOS 7.4 AMI)

Once the stack is set up, first, edit hosts, replacing the DNS names of the machines with the ones that you just created, and then run the following in sequence of commands:

```
ansible-playbook prepare.yml -i ./hosts --key-file <your keypair>.pem

ansible-playbook -i hosts openshift-ansible/playbooks/prerequisites.yml --key-file <your keypair>.pem

ansible-playbook -i hosts openshift-ansible/playbooks/deploy_cluster.yml --key-file <your keypair>.pem
```
Once that is done, ssh into the master and type
```
sudo htpasswd /etc/origin/master/htpasswd <your password>
oc adm policy add-cluster-role-to-user cluster-admin admin
```
And you should be in business:  go to your master node public DNS at port 8443 and start being shifty!

## Things Learned Along the Way

### Opt For The Containerized Install
I inititially tried the RPM install which is the default, but it appears that origin builds container images more frequently than RPMs - the RPMs that got pulled down were labeled as alpha and still had bugs that prevented the install from working.

### Changes to security groups
In the CloudFormationTemplate [from the original blog post](https://gist.github.com/mateobur/9435b803b912f3e980aacfb0151670b6) the authors set up 2 security groups - one for the master and one for the nodes, allowing ingress from any node in the VPC - or so it seemed, looking at the rules.  This led to a silent failure in the openshift SDN starting up - silent in the sense that there was no error in the log, but nodes wouldn't start up because the SDN wasn't set up.  This was fixed by creating a self referencing security group that allows access from any node in the security group and associating that with the master and all the nodes, as well having the separate master and node security groups.  See the "clusterchatter" security group in the [cloud formation template](../blob/CloudFormationTemplate).

### Labeling Nodes
I didn't see this documented anywhere, but apparently as of openshift 3.7, one has to label all the AWS nodes (excerpt from the template):
```
        - Key: kubernetes.io/cluster/openshift-on-aws
          Value: openshift-on-aws
```
The "openshift-on-aws" part can be whatever you want, but I think it has to match.  If you don't do this, the deploy_cluster.yml playbook will fail complaining about the lack of labeling.

### Setting osm_etcd_image
I think this is a bug, but what I found was that the install failed when trying to check for the existence of the etcd image unless I have the following in the [inventory file](../blob/hosts):
```
# This is needed because by default the installer registry.access.redhat.com
# even if the deployment type is origin:
# https://github.com/openshift/openshift-ansible/issues/7808
#
osm_etcd_image=registry.redhat.io/rhel7/etcd
```
