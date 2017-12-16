properties properties: [
        [$class: 'BuildDiscarderProperty', strategy: [$class: 'LogRotator', artifactDaysToKeepStr: '', artifactNumToKeepStr: '', daysToKeepStr: '30', numToKeepStr: '10']],
        [$class: 'GithubProjectProperty', displayName: '', projectUrlStr: 'https://github.com/hypery2k/gulp-galenframework'],
]

@Library('mare-build-library')
def nodeJS = new de.mare.ci.jenkins.NodeJS()

node('mac') {
  def buildNumber = env.BUILD_NUMBER
  def branchName = env.BRANCH_NAME
  def workspace = env.WORKSPACE
  def buildUrl = env.BUILD_URL

  // PRINT ENVIRONMENT TO JOB
  echo "workspace directory is $workspace"
  echo "build URL is $buildUrl"
  echo "build Number is $buildNumber"
  echo "branch name is $branchName"
  echo "PATH is $env.PATH"

  try {
    stage('Checkout') {
      checkout scm
    }

    stage('Build') {
      nodeJS.nvm('install')
    }

    stage('Test') {
      nodeJS.nvmRun('test')
      junit '*/target/tests.js.xml'
    }

    stage('Publish NPM snapshot') {
      nodeJS.publishSnapshot('.', buildNumber, branchName)
    }

  } catch (e) {
    mail subject: "${env.JOB_NAME} (${env.BUILD_NUMBER}): Error on build", to: 'github@martinreinhardt-online.de', body: "Please go to ${env.BUILD_URL}."
    throw e
  }
}
