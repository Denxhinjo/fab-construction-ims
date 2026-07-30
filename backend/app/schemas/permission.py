from pydantic import BaseModel


class LocationIdsUpdate(BaseModel):
    location_ids: list[int]
