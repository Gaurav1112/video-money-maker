import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(85);
Config.setOverwriteOutput(true);
Config.setConcurrency(2); // Prevent Chrome spawn race condition (P0 fix)
Config.setChromiumOpenGlRenderer('angle');
