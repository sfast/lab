import path from 'path';
import fse from 'fs-extra';
import childProcess from 'child_process';
import {default as Config} from '../config';

let npmInstallService = async (serviceName) => {
    let config = await Config();
    let serviceDirRoot = config.dir;

    let start = Date.now();
    console.info(`Starting service ${serviceName} npm install.`);
    let servicePath = path.resolve(`${serviceDirRoot}/dist/${serviceName}`);
    console.log(`Started installing ${serviceName} at ${servicePath}`);
    childProcess.execSync('npm i', { env: process.env, cwd: servicePath, shell : true });
    console.info(`Finished service ${serviceName} npm install, took `, Date.now() - start, ' ms');
    return true;
};

let unpackService = async (servicePack = {}) => {
    let config = await Config();
    let serviceDirRoot = config.dir;

    let {name, dist, packagejson, stamp} = servicePack;
    let start = Date.now();
    console.info(`Starting service ${name} unpacking, net transferred in : `, Date.now() - stamp, ' ms');
    let serviceName = name;
    let serviceSrc = Buffer.from(dist).toString('utf8');
    let packageJsonSrc = Buffer.from(packagejson).toString('utf8');

    let servicePath = `${serviceDirRoot}/dist/${serviceName}`;

    fse.ensureDirSync(`${servicePath}`);
    fse.outputFileSync(`${servicePath}/index.js`, serviceSrc);
    fse.outputFileSync(`${servicePath}/package.json`, packageJsonSrc);
    console.info(`Finished service ${name} unpacking, took `, Date.now() - start, ' ms');
    return true;
};

let forkService = async(serviceIdentity, serviceName, executorId, executorHost) => {
    let config = await Config();
    let serviceDirRoot = config.dir;
    let servicePath = path.resolve(`${serviceDirRoot}/dist/${serviceName}`);
    console.log("servicePath", servicePath);

    let forkArgs = ['--kitoo::sid', serviceIdentity, '--kitoo::exid', executorId, '--kitoo::exhost', executorHost];
    console.info(`Forking service ${serviceName} on executor ${executorId}, service identity: ${serviceIdentity}`);
    return childProcess.fork('index.js', forkArgs, { env: process.env, cwd: servicePath});
};

export {npmInstallService as npmInstallService};
export {unpackService as unpackService};
export {forkService as forkService};

export default  {
    npmInstallService: npmInstallService,
    unpackService: unpackService,
    forkService: forkService
}