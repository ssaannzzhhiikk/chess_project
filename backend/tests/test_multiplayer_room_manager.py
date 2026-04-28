from __future__ import annotations

from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock
from uuid import uuid4

from app.schemas import RoomMove
from app.services.multiplayer import MultiplayerRoomManager
from app.services.multiplayer_state_store import InMemoryRoomStateStore


class MultiplayerRoomManagerStoreTests(IsolatedAsyncioTestCase):
    async def test_room_state_restores_after_runtime_reset_with_persistent_store(self) -> None:
        store = InMemoryRoomStateStore()
        white_user_id = uuid4()
        black_user_id = uuid4()

        manager = MultiplayerRoomManager(state_store=store)
        room = await manager.create_room(white_user_id)
        await manager.join_room(room.room_id, black_user_id)
        await manager.process_move(
            AsyncMock(),
            room.room_id,
            white_user_id,
            RoomMove(source="e2", target="e4"),
        )

        restored_manager = MultiplayerRoomManager(state_store=store)
        restored = await restored_manager.get_room_read(room.room_id, black_user_id)

        self.assertEqual(restored.room_id, room.room_id)
        self.assertEqual(restored.moves, ["e4"])
        self.assertEqual(restored.current_fen.split()[0], "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR")
        self.assertEqual(restored.assigned_color, "black")
