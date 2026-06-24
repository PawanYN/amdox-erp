/**
 * CONTROLLER: gl.controller.ts
 * 
 * This file acts as the "Traffic Cop". It receives incoming HTTP requests (like GET or POST)
 * from the frontend, reads the URL, and forwards the work to the correct Service file.
 * DO NOT put heavy database logic here!
 */
import { Controller } from '@nestjs/common';

@Controller()
export class GlController {}
