import './story.css';

// The portrait is included in the project, so it appears automatically for everyone.
const portrait = document.querySelector('#girlfriend-photo');
portrait?.addEventListener('error', () => {
  portrait.alt = 'Фотография пока не загрузилась';
});
