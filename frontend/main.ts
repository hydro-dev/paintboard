/* eslint-disable no-alert */
import '@eirslett/jquery-ui-esm/esm/widgets/draggable';
import 'amazeui/dist/css/amazeui.min.css';
import './index.css';

import $ from 'jquery';

const delay = 8;
const H = 600;
const W = 1000;
let nowcolor = 0;
let scale = 5;
let dragged = 0;
const colorlist = [
  'rgb(0, 0, 0)', 'rgb(255, 255, 255)', 'rgb(170, 170, 170)',
  'rgb(85, 85, 85)', 'rgb(254, 211, 199)', 'rgb(255, 196, 206)',
  'rgb(250, 172, 142)', 'rgb(255, 139, 131)', 'rgb(244, 67, 54)',
  'rgb(233, 30, 99)', 'rgb(226, 102, 158)', 'rgb(156, 39, 176)',
  'rgb(103, 58, 183)', 'rgb(63, 81, 181)', 'rgb(0, 70, 112)',
  'rgb(5, 113, 151)', 'rgb(33, 150, 243)', 'rgb(0, 188, 212)',
  'rgb(59, 229, 219)', 'rgb(151, 253, 220)', 'rgb(22, 115, 0)',
  'rgb(55, 169, 60)', 'rgb(137, 230, 66)', 'rgb(215, 255, 7)',
  'rgb(255, 246, 209)', 'rgb(248, 203, 140)', 'rgb(255, 235, 59)',
  'rgb(255, 193, 7)', 'rgb(255, 152, 0)', 'rgb(255, 87, 34)',
  'rgb(184, 63, 39)', 'rgb(121, 85, 72)',
];
const c = document.getElementById('mycanvas') as HTMLCanvasElement;
const ctx = c.getContext('2d')!;
for (let i = 0; i < H; i++) {
  for (let j = 0; j < W; j++) {
    ctx.fillStyle = '#dddddd';
    ctx.fillRect(j * scale, i * scale, scale, scale);
  }
}
function update(x: number, y: number, color: number, log = true) {
  if (log) console.log('update', x, y, color);
  if (dragged) {
    dragged = 0;
    return;
  }
  ctx.fillStyle = colorlist[color];
  ctx.fillRect(x * 5, y * 5, 5, 5);
}
$('#palette').html('');
colorlist.forEach((k, v) => {
  $('#palette').append(`<div class="paleitem" data-cid=${v}></div>`);
  $(`[data-cid=${v}]`).css('background', k);
});
function zoom(s: number) {
  scale = s;
  $('#mycanvas').width(1000 * scale);
  if (s === 1) {
    $('#mycanvas').css('top', 0);
    $('#mycanvas').css('left', 0);
  }
}
$('[zoom]').click(function () {
  zoom(+$(this).attr('zoom')!);
});
zoom(1);
$('.paleitem').bind('click', function binditem() {
  $('.paleitem').removeClass('selected');
  $(this).addClass('selected');
  nowcolor = +$(this).attr('data-cid')!;
});
$('[data-cid=0]').addClass('selected');
($('#mycanvas') as any).draggable({
  cursor: 'move',
  stop() {
    dragged = 1;
  },
});
$('#mycanvas').bind('mousewheel', (event) => {
  event.preventDefault();
  const delta = (event.originalEvent as any).deltaY;
  const y = Math.floor(event.offsetY! / scale);
  const x = Math.floor(event.offsetX! / scale);
  if (delta > 0) {
    if (scale === 10) zoom(5);
    else if (scale === 5) zoom(1);
  } else if (scale === 1) zoom(5);
  else if (scale === 5) zoom(10);
  if (scale !== 1) {
    $('#mycanvas').css('top', -y * scale + 300);
    $('#mycanvas').css('left', -x * scale + 500);
  }
  return false;
});
let last = 0;
$('#mycanvas').bind('click', (event) => {
  const x = Math.floor(event.offsetX / scale);
  const y = Math.floor(event.offsetY / scale);
  if (last && Date.now() - delay * 1000 <= last) {
    alert('冷却时间未到');
    return;
  }
  last = Date.now();
  update(x, y, nowcolor);
  $.post('/api',
    { query: `{paintboard{paint(x:${x},y:${y},color:${nowcolor})}}` },
    (resp) => { if (resp.data.paintboard.paint) alert(resp.data.paintboard.paint); },
  );
  for (let i = 0; i <= delay; i++) {
    setTimeout(() => {
      if (i === delay) $('#info').text('');
      $('#info').text(`还剩 ${delay - i} 秒`);
    }, i * 1000);
  }
});
$('#login').on('click', () => {
  window.location.href = '/login?redirect=%2Fpaintboard';
});
$.post('/api', { query: '{paintboard{board}}' }, (resp) => {
  const b = resp.data.paintboard.board;
  for (let y = 0; y < b.length; y++) {
    for (let x = 0; x < b[0].length; x++) {
      if (b[y][x] !== '.') {
        update(x, y, parseInt(b[y][x], 35), false);
      }
    }
  }
});
function connect() {
  const ws = new WebSocket(`${window.location.protocol.replace('http', 'ws')}//${window.location.host}/paintboard/conn`);
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (typeof data.x === 'undefined') return;
    update(data.x, data.y, data.color);
  };
  ws.onopen = () => {
    ws.send(document.cookie);
    $('#info').text('');
  };
  ws.onclose = (e) => {
    if (e.reason.startsWith('Privilege')) $('#info').text(e.reason);
    connect();
  };
}

connect();
