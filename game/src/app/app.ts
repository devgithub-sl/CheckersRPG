import { Component, computed, signal, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

// --- Types & Interfaces ---

type Player = 'red' | 'blue';
type PieceType = 'soldier' | 'king';
type SpellType = 'dash' | 'smite';

interface Piece {
  id: string;
  player: Player;
  type: PieceType;
  isAlive: boolean;
  isKing: boolean;
}

interface Cell {
  row: number;
  col: number;
  piece: Piece | null;
  isHighlight: boolean; // For valid moves
  isTarget: boolean;    // For spell targeting
}

interface GameLog {
  message: string;
  type: 'info' | 'combat' | 'level' | 'magic';
}

interface PlayerStats {
  level: number;
  xp: number;
  xpToNext: number;
  mana: number;
  maxMana: number;
}

// --- Icons (Using simple SVGs inline) ---
const ICONS = {
  sword: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>`,
  sparkles: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>`,
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>`
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row overflow-hidden">
      
      <!-- LEFT PANEL: Red Player (Warlocks) -->
      <div class="flex-1 p-4 flex flex-col gap-4 border-r border-slate-700 bg-slate-900/50">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center border-2 border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.5)]">
            <span class="text-2xl">👹</span>
          </div>
          <div>
            <h2 class="text-xl font-bold text-red-400">Red Warlocks</h2>
            <div class="text-xs text-slate-400">Level {{ redStats().level }}</div>
          </div>
        </div>

        <!-- Stats -->
        <div class="space-y-3">
          <!-- XP Bar -->
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-slate-400">XP</span>
              <span>{{ redStats().xp }} / {{ redStats().xpToNext }}</span>
            </div>
            <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-yellow-500 transition-all duration-500" [style.width.%]="(redStats().xp / redStats().xpToNext) * 100"></div>
            </div>
          </div>
          <!-- Mana Bar -->
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-blue-300">Mana</span>
              <span>{{ redStats().mana }} / {{ redStats().maxMana }}</span>
            </div>
            <div class="h-4 bg-slate-800 rounded-full overflow-hidden relative border border-slate-700">
               <div class="absolute inset-0 flex items-center justify-center text-[10px] font-bold z-10 text-white shadow-black drop-shadow-md">
                +1 / turn
              </div>
              <div class="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500" [style.width.%]="(redStats().mana / redStats().maxMana) * 100"></div>
            </div>
          </div>
        </div>

        <!-- Spells -->
        <div class="mt-4">
          <h3 class="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Grimoire</h3>
          <div class="grid grid-cols-2 gap-2">
            <button 
              (click)="activateSpell('dash')" 
              [disabled]="currentPlayer() !== 'red' || redStats().mana < 2"
              class="p-2 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex flex-col items-center gap-1 group relative overflow-hidden">
               <div class="absolute inset-0 bg-blue-500/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
               <span class="text-xl">⚡</span>
               <span class="text-xs font-bold">Dash (2)</span>
               <span class="text-[10px] text-slate-500">Teleport Piece</span>
            </button>
            <button 
              (click)="activateSpell('smite')" 
              [disabled]="currentPlayer() !== 'red' || redStats().mana < 4"
              class="p-2 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex flex-col items-center gap-1 group relative overflow-hidden">
              <div class="absolute inset-0 bg-red-500/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
               <span class="text-xl">🔥</span>
               <span class="text-xs font-bold">Smite (4)</span>
               <span class="text-[10px] text-slate-500">Destroy Enemy</span>
            </button>
          </div>
        </div>
      </div>

      <!-- CENTER: Game Board -->
      <div class="flex-[2] flex flex-col items-center justify-center bg-slate-950 p-4 relative">
        
        <!-- Turn Indicator -->
        <div class="absolute top-4 px-6 py-2 rounded-full bg-slate-900 border border-slate-700 shadow-xl flex items-center gap-2 z-20">
          <div class="w-3 h-3 rounded-full animate-pulse" [ngClass]="currentPlayer() === 'red' ? 'bg-red-500' : 'bg-blue-500'"></div>
          <span class="font-bold uppercase tracking-widest text-sm">
            {{ activeSpell() ? 'CASTING: ' + activeSpell()?.toUpperCase() : (currentPlayer() + "'s Turn") }}
          </span>
          <button *ngIf="activeSpell()" (click)="cancelSpell()" class="ml-2 text-xs text-red-400 hover:text-red-300 underline">Cancel</button>
        </div>

        <!-- Board -->
        <div class="relative shadow-2xl rounded-lg overflow-hidden border-4 border-slate-700 bg-slate-800">
          <div class="grid grid-cols-8 gap-0 w-[min(90vw,600px)] h-[min(90vw,600px)]">
            <ng-container *ngFor="let row of board(); let r = index">
              <div *ngFor="let cell of row; let c = index"
                   (click)="handleCellClick(r, c)"
                   class="relative w-full h-full flex items-center justify-center transition-all duration-200"
                   [ngClass]="{
                     'bg-amber-100': (r + c) % 2 === 0, 
                     'bg-stone-800': (r + c) % 2 !== 0,
                     'cursor-pointer hover:brightness-110': isInteractable(r, c),
                     'ring-4 ring-inset ring-yellow-400': cell.isHighlight,
                     'ring-4 ring-inset ring-purple-500': cell.isTarget,
                     'opacity-50': activeSpell() && !isValidSpellTarget(r, c)
                   }">
                
                <!-- Piece -->
                <div *ngIf="cell.piece" 
                     class="w-[80%] h-[80%] rounded-full shadow-[0_4px_6px_rgba(0,0,0,0.5)] flex items-center justify-center relative transition-transform duration-300 transform"
                     [ngClass]="{
                       'bg-gradient-to-br from-red-500 to-red-700 ring-2 ring-red-900': cell.piece.player === 'red',
                       'bg-gradient-to-br from-blue-500 to-blue-700 ring-2 ring-blue-900': cell.piece.player === 'blue',
                       'scale-110 -translate-y-1 shadow-lg': selectedCell()?.row === r && selectedCell()?.col === c,
                       'ring-4 ring-yellow-400': cell.piece.isKing
                     }">
                     
                     <!-- King Crown -->
                     <span *ngIf="cell.piece.isKing" class="text-2xl drop-shadow-md">👑</span>
                     <span *ngIf="!cell.piece.isKing" class="opacity-50 text-xs font-bold">{{ cell.piece.player === 'red' ? 'W' : 'P' }}</span>

                     <!-- Selection Ring -->
                     <div *ngIf="selectedCell()?.row === r && selectedCell()?.col === c" class="absolute -inset-1 border-2 border-white rounded-full animate-ping opacity-75"></div>
                </div>

                <!-- Highlight Dot for move hints -->
                <div *ngIf="cell.isHighlight && !cell.piece" class="w-4 h-4 rounded-full bg-yellow-400/50 animate-pulse"></div>

              </div>
            </ng-container>
          </div>
        </div>

        <!-- Game Log (Mobile below, Desktop absolute bottom) -->
        <div class="w-full max-w-[600px] mt-4 h-32 bg-black/40 rounded-lg p-2 overflow-y-auto font-mono text-xs border border-slate-800 custom-scrollbar">
          <div *ngFor="let log of gameLog().slice().reverse()" class="mb-1">
            <span [ngClass]="{
              'text-slate-400': log.type === 'info',
              'text-red-400': log.type === 'combat',
              'text-yellow-400': log.type === 'level',
              'text-purple-400': log.type === 'magic'
            }">
              > {{ log.message }}
            </span>
          </div>
        </div>

      </div>

      <!-- RIGHT PANEL: Blue Player (Paladins) -->
      <div class="flex-1 p-4 flex flex-col gap-4 border-l border-slate-700 bg-slate-900/50">
        <div class="flex items-center gap-3 justify-end md:justify-start flex-row-reverse md:flex-row">
           <div>
            <h2 class="text-xl font-bold text-blue-400 text-right md:text-left">Blue Paladins</h2>
            <div class="text-xs text-slate-400 text-right md:text-left">Level {{ blueStats().level }}</div>
          </div>
          <div class="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center border-2 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.5)]">
            <span class="text-2xl">🛡️</span>
          </div>
        </div>

         <!-- Stats -->
         <div class="space-y-3">
          <!-- XP Bar -->
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-slate-400">XP</span>
              <span>{{ blueStats().xp }} / {{ blueStats().xpToNext }}</span>
            </div>
            <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-yellow-500 transition-all duration-500" [style.width.%]="(blueStats().xp / blueStats().xpToNext) * 100"></div>
            </div>
          </div>
          <!-- Mana Bar -->
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-blue-300">Mana</span>
              <span>{{ blueStats().mana }} / {{ blueStats().maxMana }}</span>
            </div>
            <div class="h-4 bg-slate-800 rounded-full overflow-hidden relative border border-slate-700">
               <div class="absolute inset-0 flex items-center justify-center text-[10px] font-bold z-10 text-white shadow-black drop-shadow-md">
                +1 / turn
              </div>
              <div class="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500" [style.width.%]="(blueStats().mana / blueStats().maxMana) * 100"></div>
            </div>
          </div>
        </div>

        <!-- Spells -->
        <div class="mt-4">
          <h3 class="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider text-right md:text-left">Divine Powers</h3>
          <div class="grid grid-cols-2 gap-2">
            <button 
              (click)="activateSpell('dash')" 
              [disabled]="currentPlayer() !== 'blue' || blueStats().mana < 2"
              class="p-2 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex flex-col items-center gap-1 group relative overflow-hidden">
              <div class="absolute inset-0 bg-blue-500/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
               <span class="text-xl">✨</span>
               <span class="text-xs font-bold">Dash (2)</span>
               <span class="text-[10px] text-slate-500">Teleport Piece</span>
            </button>
            <button 
              (click)="activateSpell('smite')" 
              [disabled]="currentPlayer() !== 'blue' || blueStats().mana < 4"
              class="p-2 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex flex-col items-center gap-1 group relative overflow-hidden">
              <div class="absolute inset-0 bg-red-500/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
               <span class="text-xl">🔨</span>
               <span class="text-xs font-bold">Smite (4)</span>
               <span class="text-[10px] text-slate-500">Destroy Enemy</span>
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- Win Modal -->
    <div *ngIf="winner()" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm">
      <div class="bg-slate-800 p-8 rounded-2xl border-2 border-yellow-500 text-center shadow-2xl max-w-sm w-full">
        <div class="text-6xl mb-4">🏆</div>
        <h2 class="text-3xl font-bold text-white mb-2 uppercase">{{ winner() }} WINS!</h2>
        <p class="text-slate-400 mb-6">The battle is over.</p>
        <button (click)="resetGame()" class="w-full py-3 bg-yellow-500 text-black font-bold rounded hover:bg-yellow-400 transition">New Game</button>
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
  `]
})
export class App implements OnInit {
  // --- State Signals ---
  board = signal<Cell[][]>([]);
  currentPlayer = signal<Player>('red'); // Red moves first
  selectedCell = signal<{row: number, col: number} | null>(null);
  winner = signal<Player | null>(null);
  gameLog = signal<GameLog[]>([]);
  
  // Spell State
  activeSpell = signal<SpellType | null>(null);
  
  // Stats
  redStats = signal<PlayerStats>({ level: 1, xp: 0, xpToNext: 100, mana: 2, maxMana: 5 });
  blueStats = signal<PlayerStats>({ level: 1, xp: 0, xpToNext: 100, mana: 2, maxMana: 5 });

  ngOnInit() {
    this.resetGame();
  }

  resetGame() {
    this.initBoard();
    this.currentPlayer.set('red');
    this.winner.set(null);
    this.gameLog.set([{ message: 'Game Started! Red moves first.', type: 'info' }]);
    this.activeSpell.set(null);
    this.selectedCell.set(null);
    this.redStats.set({ level: 1, xp: 0, xpToNext: 100, mana: 2, maxMana: 5 });
    this.blueStats.set({ level: 1, xp: 0, xpToNext: 100, mana: 2, maxMana: 5 });
  }

  initBoard() {
    const newBoard: Cell[][] = [];
    for (let r = 0; r < 8; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < 8; c++) {
        let piece: Piece | null = null;
        if ((r + c) % 2 !== 0) { // Black squares only
          if (r < 3) piece = { id: `b-${r}-${c}`, player: 'blue', type: 'soldier', isAlive: true, isKing: false };
          if (r > 4) piece = { id: `r-${r}-${c}`, player: 'red', type: 'soldier', isAlive: true, isKing: false };
        }
        row.push({ row: r, col: c, piece, isHighlight: false, isTarget: false });
      }
      newBoard.push(row);
    }
    this.board.set(newBoard);
  }

  // --- Interaction Handler ---

  handleCellClick(r: number, c: number) {
    if (this.winner()) return;

    // SPELLCASTING MODE
    if (this.activeSpell()) {
      this.executeSpell(r, c);
      return;
    }

    // STANDARD MOVEMENT MODE
    const cell = this.board()[r][c];
    
    // 1. Select a piece
    if (cell.piece && cell.piece.player === this.currentPlayer()) {
      this.selectedCell.set({ row: r, col: c });
      this.highlightValidMoves(r, c, cell.piece);
      return;
    }

    // 2. Move to highlighted cell
    if (cell.isHighlight && this.selectedCell()) {
      this.movePiece(this.selectedCell()!.row, this.selectedCell()!.col, r, c);
    }
  }

  // --- Move Logic ---

  highlightValidMoves(r: number, c: number, piece: Piece) {
    const board = this.board();
    // Reset highlights
    board.forEach(row => row.forEach(cell => cell.isHighlight = false));

    const moves = this.getValidMoves(r, c, piece, board);
    moves.forEach(m => {
      board[m.toR][m.toC].isHighlight = true;
    });
    this.board.set([...board]); // Trigger update
  }

  getValidMoves(r: number, c: number, piece: Piece, board: Cell[][]) {
    const moves: {toR: number, toC: number, jump?: {r: number, c: number}}[] = [];
    const directions = piece.isKing ? [-1, 1] : (piece.player === 'red' ? [-1] : [1]);
    
    // Check simple moves & jumps
    // Note: This is a simplified Checkers logic (no forced jump chain enforcement for this RPG demo)
    
    const checkDirs = piece.isKing ? [-1, 1] : directions;

    checkDirs.forEach(dRow => {
      [-1, 1].forEach(dCol => {
        const newR = r + dRow;
        const newC = c + dCol;

        if (this.isValidPos(newR, newC)) {
          // Empty spot?
          if (!board[newR][newC].piece) {
             moves.push({ toR: newR, toC: newC });
          } 
          // Enemy spot? Check jump
          else if (board[newR][newC].piece?.player !== piece.player) {
            const jumpR = newR + dRow;
            const jumpC = newC + dCol;
            if (this.isValidPos(jumpR, jumpC) && !board[jumpR][jumpC].piece) {
              moves.push({ toR: jumpR, toC: jumpC, jump: {r: newR, c: newC} });
            }
          }
        }
      });
    });

    return moves;
  }

  isValidPos(r: number, c: number) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  movePiece(fromR: number, fromC: number, toR: number, toC: number) {
    const board = this.board();
    const movingPiece = board[fromR][fromC].piece!;
    const targetCell = board[toR][toC];

    // Check if it was a jump
    // We need to re-calculate move type or store it in highlight. 
    // Simplification: Distance check
    const isJump = Math.abs(toR - fromR) > 1;

    // Move
    board[toR][toC].piece = movingPiece;
    board[fromR][fromC].piece = null;
    board[fromR][fromC].isHighlight = false; // clear selection visual

    // Handle Capture
    if (isJump) {
      const capturedR = (fromR + toR) / 2;
      const capturedC = (fromC + toC) / 2;
      const capturedPiece = board[capturedR][capturedC].piece;
      
      board[capturedR][capturedC].piece = null; // Remove captured
      this.addLog(`${this.currentPlayer().toUpperCase()} crushed an enemy!`, 'combat');
      
      // RPG ELEMENT: Gain XP
      this.gainXp(this.currentPlayer(), 50);
    }

    // Handle King Promotion
    if ((movingPiece.player === 'red' && toR === 0) || (movingPiece.player === 'blue' && toR === 7)) {
      if (!movingPiece.type.includes('king')) {
        movingPiece.type = 'king';
        movingPiece.isKing = true; // Helper property for UI
        this.addLog(`${this.currentPlayer().toUpperCase()} promoted a piece to King!`, 'level');
        this.gainXp(this.currentPlayer(), 20); // Bonus XP for promotion
      }
    }

    // Cleanup highlights
    board.forEach(row => row.forEach(c => c.isHighlight = false));
    this.board.set([...board]);
    this.selectedCell.set(null);
    
    this.endTurn();
  }

  // --- RPG Systems ---

  gainXp(player: Player, amount: number) {
    const statsSig = player === 'red' ? this.redStats : this.blueStats;
    const stats = { ...statsSig() };
    
    stats.xp += amount;
    if (stats.xp >= stats.xpToNext) {
      // LEVEL UP
      stats.level++;
      stats.xp -= stats.xpToNext;
      stats.xpToNext = Math.floor(stats.xpToNext * 1.5);
      stats.maxMana += 2; // Increase Max Mana
      stats.mana = stats.maxMana; // Full heal Mana
      this.addLog(`${player.toUpperCase()} Leveled Up to ${stats.level}! Max Mana increased.`, 'level');
    }
    statsSig.set(stats);
  }

  endTurn() {
    // Regen Mana for next player
    const nextPlayer = this.currentPlayer() === 'red' ? 'blue' : 'red';
    const statsSig = nextPlayer === 'red' ? this.redStats : this.blueStats;
    const stats = { ...statsSig() };
    
    if (stats.mana < stats.maxMana) {
      stats.mana += 1;
    }
    statsSig.set(stats);

    this.currentPlayer.set(nextPlayer);
    this.checkWinCondition();
  }

  checkWinCondition() {
    const redAlive = this.board().some(r => r.some(c => c.piece?.player === 'red'));
    const blueAlive = this.board().some(r => r.some(c => c.piece?.player === 'blue'));
    
    if (!redAlive) this.winner.set('blue');
    if (!blueAlive) this.winner.set('red');
  }

  // --- Spells ---

  activateSpell(spell: SpellType) {
    if (this.activeSpell() === spell) {
      this.cancelSpell();
      return;
    }
    this.activeSpell.set(spell);
    this.highlightSpellTargets(spell);
    this.addLog(`Casting ${spell.toUpperCase()}... Select target.`, 'magic');
  }

  cancelSpell() {
    this.activeSpell.set(null);
    // clear targets
    const board = this.board();
    board.forEach(r => r.forEach(c => c.isTarget = false));
    this.board.set([...board]);
  }

  highlightSpellTargets(spell: SpellType) {
    const board = this.board();
    board.forEach((row, r) => row.forEach((cell, c) => {
      cell.isTarget = false;
      cell.isHighlight = false; // Clear move highlights

      if (spell === 'dash') {
        // Dash: Teleport OWN piece to EMPTY spot
        // Phase 1: We need to select a piece first? Or target empty spot?
        // Let's make Dash: Select ANY empty black square to teleport currently selected piece?
        // Simpler implementation: "Summon" - create a new pawn? No.
        // Let's implement Smite first, it's easier. 
        // Dash implementation: Select empty square. BUT which piece moves?
        // Re-design Dash: Select valid Piece -> Then select Empty Square. Too complex for simple click.
        // New Dash: Select an EMPTY square. Moves the most forward piece? No.
        // Let's change Dash to "Reinforce": Spawn a soldier on your back row.
        // Actually, let's keep Dash but make it: Click an empty square, and it teleports your King there?
        // BETTER: Dash = Select one of YOUR pieces, it immediately jumps 2 squares forward.
        // EASIEST: Smite (Destroy Enemy) & Heal (Restore Health?).
        // Let's stick to Smite (Target Enemy) and Teleport (Target Empty Square, moves random piece? No, let's make Teleport: Select YOUR piece, then click again... 
        // For simplicity of this demo: 
        // Spell 1: Smite (Click Enemy to kill). 
        // Spell 2: Dash (Click YOUR piece, it moves forward 1 row safely).
        
        if (spell === 'dash') {
             // Target own pieces
             if (cell.piece?.player === this.currentPlayer()) {
                 cell.isTarget = true;
             }
        }
      } else if (spell === 'smite') {
        // Target ENEMY pieces
        if (cell.piece && cell.piece.player !== this.currentPlayer()) {
          cell.isTarget = true;
        }
      }
    }));
    this.board.set([...board]);
  }

  isValidSpellTarget(r: number, c: number): boolean {
    return this.board()[r][c].isTarget;
  }

  executeSpell(r: number, c: number) {
    const board = this.board();
    const cell = board[r][c];
    const spell = this.activeSpell();
    const player = this.currentPlayer();
    const statsSig = player === 'red' ? this.redStats : this.blueStats;
    
    if (!cell.isTarget) return; // Invalid target

    if (spell === 'smite') {
      // Cost 4
      statsSig.update(s => ({...s, mana: s.mana - 4}));
      cell.piece = null; // POOF
      this.addLog(`${player.toUpperCase()} used Smite! Enemy obliterated.`, 'magic');
      this.gainXp(player, 30);
      this.cancelSpell();
      this.endTurn();
    } 
    else if (spell === 'dash') {
      // Dash Logic: Move selected piece 2 rows forward (or as far as possible)
      // Cost 2
      statsSig.update(s => ({...s, mana: s.mana - 2}));
      const piece = cell.piece!;
      
      // Calculate destination
      const direction = piece.player === 'red' ? -1 : 1;
      let targetR = r + (direction * 2);
      if (targetR < 0) targetR = 0;
      if (targetR > 7) targetR = 7;
      
      // If blocked, try 1 square
      if (board[targetR][c].piece) {
          targetR = r + direction;
      }
      
      if (!board[targetR][c].piece && this.isValidPos(targetR, c)) {
          board[targetR][c].piece = piece;
          board[r][c].piece = null;
          this.addLog(`${player.toUpperCase()} used Dash! Unit surged forward.`, 'magic');
      } else {
          this.addLog(`Dash failed! Path blocked. Mana consumed.`, 'magic');
      }
      
      this.cancelSpell();
      this.endTurn();
    }
  }

  // --- Utils ---
  addLog(msg: string, type: GameLog['type']) {
    this.gameLog.update(logs => [...logs, { message: msg, type }]);
  }
  
  isInteractable(r: number, c: number): boolean {
    const cell = this.board()[r][c];
    if (this.activeSpell()) return cell.isTarget;
    if (this.winner()) return false;
    // Normal mode: interactable if own piece OR highlighted empty spot
    if (cell.piece?.player === this.currentPlayer()) return true;
    if (cell.isHighlight) return true;
    return false;
  }
}