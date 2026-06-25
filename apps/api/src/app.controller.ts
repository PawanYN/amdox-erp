import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello() {
    return {
      message: 'Welcome to Amdox ERP API! The backend server is running perfectly.',
      docs: 'http://localhost:3001/api-docs'
    };
  }
}
