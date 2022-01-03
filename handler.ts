import { registerResolver } from 'hydrooj/src/handler/api';
import db from 'hydrooj/src/service/db';
import { Connection, ConnectionHandler, Handler, Route } from 'hydrooj/src/service/server';
import { PRIV } from 'hydrooj/src/model/builtin';
import { Time } from 'hydrooj/src/utils';
import * as bus from 'hydrooj/src/service/bus';

interface PaintboardColl {
    x: number;
    y: number;
    color: number;
    effective: boolean;
    uid: number;
}
declare module 'hydrooj/src/interface' {
    interface Collections {
        paintboard: PaintboardColl;
    }
}
const coll = db.collection('paintboard');

registerResolver('Query', 'paintboard', 'Paintboard!', () => ({}));
registerResolver('Paintboard', 'board', '[[Int]]', async () => {
    const res = await coll.find({ effective: true }).toArray();
    return res.map(x => [x.x, x.y, x.color]);
});
registerResolver('Paintboard', 'paint(x: Int!, y: Int!, color: Int!)', 'String', async (args, ctx) => {
    if (!ctx.user.hasPriv(PRIV.PRIV_USER_PROFILE)) return '请先登录';
    const timeFilter = { $gt: Time.getObjectID(new Date(Date.now() - 8 * 1000), true) };
    if (args.x <= 0 || args.y <= 0 || args.x > 1000 || args.y > 600) return '坐标超出范围';
    if (await coll.findOne({ _id: timeFilter, uid: ctx.user._id })) return '冷却时间未到';
    await coll.updateMany({ x: args.x, y: args.y }, { $set: { effective: false } });
    await coll.insertOne({ ...args, effective: true, uid: ctx.user._id });
    bus.broadcast('paintboard/paint', args);
});

bus.on('app/started', () => {
    db.ensureIndexes(coll, [
        { key: { x: 1, y: 1 }, name: 'pos' },
        { key: { uid: 1 }, name: 'user' },
    ])
})

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
