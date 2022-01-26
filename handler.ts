import { registerResolver } from 'hydrooj/src/handler/api';
import db from 'hydrooj/src/service/db';
import * as bus from 'hydrooj/src/service/bus';
import { Connection, ConnectionHandler, Handler, Route } from 'hydrooj/src/service/server';
import { PRIV } from 'hydrooj/src/model/builtin';
import { Time } from 'hydrooj/src/utils';
import { Logger } from 'hydrooj/src/logger';

interface PaintboardColl {
    x: number;
    y: number;
    color: number;
    effective: boolean;
    uid: number;
}

const logger = new Logger('paintboard');
const dict = '0123456789abcdefghijklmnopqrstuvwxyz';
const currentBoard = [];
for (let i = 1; i <= 600; i++) currentBoard.push('.'.repeat(1000));

declare module 'hydrooj/src/interface' {
    interface Collections {
        paintboard: PaintboardColl;
    }
}
const coll = db.collection('paintboard');

registerResolver('Query', 'paintboard', 'Paintboard!', () => ({}));
registerResolver('Paintboard', 'board', '[String]', () => currentBoard);
registerResolver('Paintboard', 'paint(x: Int!, y: Int!, color: Int!)', 'String', async (args, ctx) => {
    if (!ctx.user.hasPriv(PRIV.PRIV_USER_PROFILE)) return '请先登录';
    if (args.x < 0 || args.y < 0 || args.x >= 1000 || args.y >= 600) return '坐标超出范围';
    if (args.color > 32) return '无效颜色';
    const timeFilter = { $gt: Time.getObjectID(new Date(Date.now() - 8 * 1000), true) };
    if (await coll.findOne({ _id: timeFilter, uid: ctx.user._id })) return '冷却时间未到';
    await coll.updateMany({ x: args.x, y: args.y }, { $set: { effective: false } });
    await coll.insertOne({ ...args, effective: true, uid: ctx.user._id });
    bus.broadcast('paintboard/paint', args);
});

function update(x: number, y: number, color: number) {
    currentBoard[y] = currentBoard[y].substr(0, x) + dict[color] + currentBoard[y].substr(x + 1);
}
bus.on('paintboard/paint', (args) => update(args.x, args.y, args.color));
bus.on('app/started', () => Promise.all([
    db.ensureIndexes(
        coll,
        { key: { x: 1, y: 1 }, name: 'pos' },
        { key: { uid: 1 }, name: 'user' },
    ),
    (async () => {
        const res = await coll.find({ effective: true }).toArray();
        for (const { x, y, color } of res) update(x, y, color);
        logger.success('Loaded board with %d pixels', res.length);
    })(),
]));

class ConnHandler extends ConnectionHandler {
    listener: () => boolean;

    prepare() {
        this.listener = bus.on('paintboard/paint', (args) => this.send(args));
    }

    cleanup() {
        bus.off('paintboard/paint', this.listener);
    }
}

class PaintboardHandler extends Handler {
    get() {
        this.response.template = 'paintboard.html';
    }
}

global.Hydro.handler.paintboard = () => {
    Connection('paintboard_conn', '/paintboard/conn', ConnHandler);
    Route('paintboard', '/paintboard', PaintboardHandler);
}
