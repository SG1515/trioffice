package com.kcc.trioffice.domain.common.mapper;


import com.kcc.trioffice.domain.common.domain.SearchChatRoom;
import com.kcc.trioffice.domain.employee.dto.response.SearchEmployee;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;
import java.util.Optional;

@Mapper
public interface SearchMapper {

    List<SearchEmployee> getAllEmployeesInfo(Long employeeId);

    List<Long> getMyChatRooms(Long employeeId);

    List<Long> participationEmployeeFindByChatRoomId(Long chatRoomId);

    List<SearchEmployee> getChangeAllEmployeesInfo(Long employeeId, String keyword);

    List<Long> getChangeMyChatRooms(Long employeeId);

    List<SearchEmployee> getAllEmployeesInfoByKeyword(Long companyId, String keyword);

    String getRoomName(Long chatRoomId);
}
