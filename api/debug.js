const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async (req, res) => {
    const report = {
        platform: process.platform,
        cwd: process.cwd(),
        dirname: __dirname,
        env: {
            PATH: process.env.PATH,
            NODE_VERSION: process.version
        },
        files: {}
    };

    const pathsToCheck = [
        path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin'),
        path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin'),
        '/var/task/node_modules/youtube-dl-exec/bin'
    ];

    pathsToCheck.forEach(p => {
        try {
            if (fs.existsSync(p)) {
                report.files[p] = fs.readdirSync(p);
            } else {
                report.files[p] = 'NOT_FOUND';
            }
        } catch (e) {
            report.files[p] = 'ERROR: ' + e.message;
        }
    });

    try {
        report.pythonVersion = execSync('python3 --version').toString().trim();
    } catch (e) {
        report.pythonVersion = 'ERROR: ' + e.message;
    }

    try {
        report.ytDlpInPath = execSync('which yt-dlp').toString().trim();
    } catch (e) {
        report.ytDlpInPath = 'NOT_FOUND';
    }

    res.status(200).json(report);
};
