import './styles.css';
import { Editor } from './app/Editor';

declare global {
  interface Window {
    minipaint: Editor;
  }
}

const root = document.getElementById('app');
if (!root) throw new Error('未找到 #app 挂载点');

const editor = new Editor(root);
window.minipaint = editor;
