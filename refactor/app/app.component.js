import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  template: `
    <!-- This will be replaced by the main application component logic -->
    <div class="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
      <div class="text-center">
        <h1 class="text-4xl font-bold">Orbital8 Refactor</h1>
        <p class="text-xl mt-4">Angular Application Shell - Ready for Component Implementation.</p>
      </div>
    </div>
  `,
  standalone: true,
  imports: [CommonModule],
})
export class AppComponent {}
